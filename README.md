# ProjectX (Capture. Understand. Handover.)

ProjectX is an AI-powered knowledge hub that turns scattered project knowledge into evidence-linked handover reports.

This repository houses the modular backend service for ProjectX.

---

## Tech Stack

- **Runtime & Language**: Python 3.12
- **Framework**: FastAPI (async) with Uvicorn
- **Package Manager**: [uv](https://docs.astral.sh/uv/)
- **Database**: PostgreSQL 17 (async via SQLAlchemy 2.0 & asyncpg)
- **Migrations**: Alembic (async template)
- **Validation**: Pydantic v2 & `pydantic-settings`
- **Security & Passwords**: Argon2id hashing via `pwdlib[argon2]`, JWT access tokens via `pyjwt[crypto]`
- **Vector Store**: Qdrant (`qdrant-client` async)
- **Graph Database**: Neo4j (optional, disabled by default behind compose profile)
- **LLM**: Gemini via the official `google-genai` SDK
- **HTTP Client**: HTTPX (async)
- **Processors**: `pypdf`, `python-docx`, `python-pptx`, `tiktoken`
- **Testing & Quality**: pytest, pytest-asyncio, respx, ruff

---

## Architecture

The backend follows a **modular monolith** architecture located in `backend/app/`:

```
backend/
├── app/
│   ├── core/          # App settings, Argon2/JWT security, exception handlers
│   ├── db/            # Base models, async session factory, get_db dependency
│   ├── models/        # SQLAlchemy 2.0 ORM entities (UUID PKs, timestamps, cascades)
│   ├── schemas/       # Pydantic v2 schemas for validation and serialization
│   ├── api/v1/        # Presentation layer: auth, projects, members, sources, ingestion, health
│   ├── services/      # Business logic & DB transactions: chunking, ingestion, storage, projects
│   ├── integrations/  # External APIs & Connectors (GitHub, Qdrant, Gemini, Neo4j)
│   ├── processors/    # File processors: PDF, Markdown, DOCX, PPTX, plain text, Code (Python, TS/JS)
│   └── workers/       # Standalone ingestion worker with row locking & stuck-job recovery
├── alembic/           # Async database migration versions and environment
├── tests/             # Pytest test suite running against a separate test DB
├── AGENT_RULES.md     # Engineering guidelines and architectural rules
├── pyproject.toml     # uv package definitions and tool configurations
├── Dockerfile         # Production container build
└── .env.example       # Sample environment configuration
```

---

## Quickstart

### 1. Prerequisites
- Docker & Docker Compose v2
- [uv](https://docs.astral.sh/uv/) (v0.5+)
- Python 3.12

### 2. Configure Environment
Copy the example environment file:
```bash
cp backend/.env.example backend/.env
```

### 3. Start Infrastructure Services
Start PostgreSQL 17 and Qdrant in detached mode:
```bash
docker compose up -d
```
> Neo4j is optional and behind a compose profile. To run with Neo4j: `docker compose --profile neo4j up -d`.

### 4. Run Database Migrations
Apply Alembic migrations:
```bash
cd backend
uv run alembic upgrade head
```

### 5. Start the Backend API Server
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```
Interactive API documentation:
- **Swagger UI**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **ReDoc**: [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 6. Run the Ingestion Worker

The ingestion pipeline runs on a dedicated database-backed queue using PostgreSQL row-level locking (`SELECT ... FOR UPDATE SKIP LOCKED`), with automatic stuck-job recovery and retry limits.

**Run locally with uv:**
```bash
cd backend
uv run python -m app.workers.ingestion_worker
```

**Run via Docker Compose:**
```bash
docker compose up -d worker
```

---

## Ingestion Pipeline Details

1. **Connectors**:
   - `GitHubConnector`: Connects to GitHub repositories via async HTTPX. Fetches repo metadata, README, directory tree, code & doc files, recent commits, and issues/pull requests. Automatically skips lockfiles, binaries, `node_modules`, and vendor trees.
   - `UploadConnector`: Connects to multipart uploaded files saved in storage abstraction.
2. **Processors**:
   - **PDF**: Page-aware text extraction preserving page numbers.
   - **Markdown**: Heading-aware section segmentation preserving heading hierarchy (`#`, `##`, `###`) and line numbers.
   - **DOCX**: Word paragraph and heading style extraction.
   - **PPTX**: Slide-aware text extraction tracking slide numbers and shape text.
   - **Code**: Symbol-boundary parser for Python (`def`, `async def`, `class`) and TypeScript/JavaScript (`function`, `class`, `interface`, `type`), with line-block fallbacks for other languages.
   - **Plain Text**: Block and line-range aware extraction.
3. **Chunking**:
   - Prose chunked to ~800-1000 tokens with configurable overlap (`CHUNK_SIZE_TOKENS`, `CHUNK_OVERLAP_TOKENS`).
   - Code chunked along symbol boundaries.
   - Every chunk preserves `document_id`, `source_id`, `file_path`, and `page` or `line_start`/`line_end` range for precise evidence citation.
4. **Idempotency**:
   - Uses SHA-256 content hashes and source paths.
   - Re-ingesting unchanged sources creates **zero duplicate documents or chunks**.
   - Modified files are updated and re-chunked; removed files are marked as `removed`.

---

## Testing & Quality

Run the test suite against the isolated test database:
```bash
cd backend
uv run pytest
```

Run linter and formatting checks:
```bash
cd backend
uv run ruff check
uv run ruff format --check
```

---

## API Endpoints (v1)

### Health
- `GET /health` - Service health probe with PostgreSQL connectivity check
- `GET /api/v1/health` - API v1 health probe

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user account (Argon2id password hashing)
- `POST /login` - Authenticate with email/password and receive JWT access token
- `GET /me` - Get current authenticated user profile

### Projects & Access Control (`/api/v1/projects`)
- `POST /` - Create project (caller becomes `owner`)
- `GET /` - List all projects where current user has membership
- `GET /{project_id}` - Get project details & members (requires `viewer`+)
- `PATCH /{project_id}` - Update project name/description (requires `admin`+)
- `DELETE /{project_id}` - Delete project (requires `owner`)

### Project Members (`/api/v1/projects/{project_id}/members`)
- `GET /` - List project members with roles (requires `viewer`+)
- `POST /` - Add member by email with role (requires `admin`+)
- `PATCH /{member_id}` - Update member role (requires `admin`+; `owner` for owner roles)
- `DELETE /{member_id}` - Remove member from project (requires `admin`+; prevents removing sole owner)

### Knowledge Sources (`/api/v1/projects/{project_id}/sources`)
- `POST /github` - Connect a GitHub repo as knowledge source (requires `admin`+)
- `POST /upload` - Multipart file upload (PDF, Markdown, DOCX, PPTX, text) (requires `member`+)
- `GET /` - List connected sources for project (requires `viewer`+)
- `DELETE /{source_id}` - Delete source and cascade remove associated documents (requires `admin`+)

### Ingestion Jobs (`/api/v1/projects/{project_id}/ingestion/jobs`)
- `POST /` - Enqueue an ingestion job for all or selected project sources (requires `member`+)
- `GET /` - List all ingestion jobs for project (requires `viewer`+)
- `GET /{job_id}` - Get status, progress percentage, error, and timestamps (requires `viewer`+)

### Knowledge & Verification (`/api/v1/projects/{project_id}/knowledge`)
- `GET /` - List knowledge items with filters (`category`, `review_status`, `origin`, `min_confidence`, `max_confidence`, `verified`, search `q`) and pagination (requires `viewer`+)
- `GET /{item_id}` - Get single knowledge item with loaded evidence, relational tasks, and dependency graph (requires `viewer`+)
- `POST /{item_id}/review` - Review (approve, reject, edit) knowledge item with auditor identity & timestamp tracking (requires `reviewer`+)
- `POST /bulk-review` - Bulk review status update across multiple items (requires `reviewer`+)
- `GET /gaps` - List detected knowledge gaps (missing owners/dates, decisions lacking rationale, risks without mitigation, unverified evidence) (requires `viewer`+)
- `GET /conflicts` - List detected conflicting decisions and opposing technical stances (requires `viewer`+)

### Task Tracking (`/api/v1/projects/{project_id}/tasks`)
- `GET /` - List and filter tasks with rich filters (`status`, `is_completed`, `is_blocked`, `owner_id`, `due_before`, `due_after`, `priority`) and pagination (requires `viewer`+)
- `GET /progress` - Task completion metrics (total, completed, in-progress, todo, blocked, cancelled, overdue, unassigned, completion percentage) (requires `viewer`+)
- `PATCH /{task_id}` - Audited update of task status, owner, priority, due date, title, or description (requires `member`+)

### Dependency Mapping & Graph Analysis (`/api/v1/projects/{project_id}/dependencies`)
- `GET /graph` - Full project dependency graph returning nodes, edges, cycle detection findings, and blocked chains findings (requires `viewer`+)
- `GET /subgraph/{node_id}` - Upstream and downstream subgraph for a specific node traversed up to depth $N$ via PostgreSQL recursive CTE (requires `viewer`+)
- `POST /sync-neo4j` - Mirror approved knowledge items and dependencies into Neo4j when enabled (requires `admin`+)

### Risk Detection (`/api/v1/projects/{project_id}/risks`)
- `GET /` - Unified risk audit combining extracted risks with deterministic computed signals (overdue tasks, missing owners, unresolved conflicts, unverified grounding, stale tasks, SPOK) with severity breakdown and filters (requires `viewer`+)

### Project Timeline (`/api/v1/projects/{project_id}/timeline`)
- `GET /` - Chronological timeline feed combining milestones, decisions, commit history, and task status changes with date filters and pagination (requires `viewer`+)

### Project Dashboard Summary (`/api/v1/projects/{project_id}/dashboard`)
- `GET /` - Unified single-call dashboard payload aggregating project metadata, item categories, review statuses, open risk severities, task progress, last ingestion status, recent activity, and critical highlights (requires `viewer`+)

### Semantic Search & Contextual Q&A (`/api/v1/projects/{project_id}`)
- `POST /search` - Contextual Q&A (default) or plain ranked search (`include_answer=false`) (requires `viewer`+)
- `GET /search` - Plain search box endpoint returning ranked evidence-linked results (requires `viewer`+)
- `POST /reindex` - Reindex all chunks and curated knowledge items into Qdrant (requires `admin`+)

---

## AI Knowledge Extraction & Evidence Verification

1. **Gemini Integration (`app/integrations/gemini.py`)**:
   - Async client using the official `google-genai` SDK with structured JSON output validated by Pydantic models.
   - Configurable model (default `gemini-2.5-flash`), temperature (`0.1`), bounded concurrency semaphore, timeout, and exponential backoff retry.
   - Versioned prompts in `app/prompts/` instructing the model to extract decisions, tasks, dependencies, risks, milestones, and insights without hallucinating.

2. **Programmatic Evidence Verification (`app/services/evidence_verifier.py`)**:
   - Every candidate insight extracted by the LLM is programmatically matched against its source chunk before being marked verified.
   - Uses multi-stage fuzzy and normalized matching (exact substring, whitespace-normalized, case-insensitive, punctuation-scrubbed, sliding sequence matcher).
   - Hallucinated or unverified excerpts are flagged `verified=False` and marked with `[UNVERIFIED_EVIDENCE]` for human review—never presented as verified facts.

3. **Deduplication, Conflict Detection, and Gaps**:
   - Near-duplicate items across chunks (similarity threshold >= 0.82) are merged into a canonical `KnowledgeItem`, appending new `Evidence` records rather than duplicating items.
   - Conflicting decisions on the same topic are detected and flagged with `[CONFLICT_DETECTED]`.
   - Tasks lacking owner/due date, decisions lacking rationale, and risks lacking mitigation plans are flagged as actionable knowledge gaps.
   - Extraction is idempotent per chunk via `DocumentChunk.extraction_version`.

---

## Semantic Retrieval & Contextual Q&A

1. **Qdrant Vector Index (`app/integrations/qdrant.py`)**:
   - Single collection design (`projectx_knowledge`) with mandatory `project_id` filtering on all searches to ensure strict multi-tenant isolation.
   - Payload field indexes for fast filtered lookups on `project_id`, `document_id`, `chunk_id`, `source_id`, `category`, `entity_type`, and `verified`.
   - Stored model and dimension metadata; collection rejects or triggers reindexing if model or dimension configuration changes.

2. **Gemini Embeddings**:
   - Embeddings powered by the official Google GenAI model `text-embedding-004` (configurable dimension 768).
   - Generates embeddings for document chunks (`RETRIEVAL_DOCUMENT`) and curated knowledge items, with batched and concurrency-controlled calls.

3. **Hybrid Retrieval (`app/services/retrieval_service.py`)**:
   - Combines Qdrant dense vector search with PostgreSQL full-text keyword search (`to_tsvector` and `plainto_tsquery`).
   - Merges results via Reciprocal Rank Fusion (RRF) with a boost for approved curated knowledge items.
   - Automatic fallback to PostgreSQL keyword search if Qdrant or embedding services are unavailable, indicated via `retrieval_mode="keyword_fallback"`.

4. **Contextual Q&A with Citation Verification**:
   - Answers questions strictly using retrieved context chunks and curated items.
   - Programmatically verifies cited excerpts against source chunk text before returning them.
   - Rejects out-of-domain questions with `is_sufficient=false` and `confidence=0.0` without hallucinating.

---

## Dependency Graph, Risks, Timeline & Task Tracking

1. **Dependency Mapping & Graph Algorithms (`app/services/graph_service.py`)**:
   - Traversal via **PostgreSQL recursive Common Table Expressions (CTE)** for upstream and downstream traversal up to depth $N$ without N+1 queries.
   - **Circular Dependency Detection**: Depth-first search (DFS) with recursion stack cycle tracking; detects cycles and flags them with `critical` severity.
   - **Blocked Chains Detection**: Identifies downstream items blocked by incomplete tasks, blocked tasks, or rejected architectural decisions with `high` severity.
   - **Optional Neo4j Mirroring (`app/integrations/neo4j.py`, `app/services/neo4j_sync_service.py`)**: Behind `NEO4J_ENABLED=false` (off by default); mirrors approved items and relational edges when enabled. The backend functions 100% identically without Neo4j.

2. **Deterministic Risk Detection (`app/services/risk_service.py`)**:
   - Combines AI-extracted risks with deterministic relational signals:
     - **Overdue Tasks**: Non-completed tasks past their due date (`critical` if >= 7 days, `high` otherwise).
     - **Unassigned Tasks**: Incomplete tasks without designated owners (`medium` / `high` if due within 3 days).
     - **Stale Tasks**: Tasks inactive with no status changes for > 14 days (`medium`).
     - **Unresolved Conflicts**: Items flagged with contradictory architectural stances (`high`).
     - **Unverified Grounding**: Items with unverified evidence excerpts or low model confidence (< 0.70).
     - **Single Point of Knowledge (SPOK)**: Repositories where > 85% of analyzed commits belong to a single author (`high` bus factor).
   - Every risk includes severity rating, deterministic rationale, and supporting evidence links.

3. **Project Timeline (`app/services/timeline_service.py`)**:
   - Aggregates milestones, key decisions, task lifecycle transitions, and source commit histories.
   - Sorted in reverse chronological order with date range filters (`start_date`, `end_date`), event type filtering, and pagination.

4. **Task Tracking & Audited Updates (`app/services/task_service.py`)**:
   - Rich task filtering by status, completion flag, blocked flag, owner, and due dates.
   - Audited PATCH updates logging user attribution and timestamped transition traces into the task's audit history.
   - Instant progress summary calculating completion percentages, overdue counts, and blocked item counts.

5. **Project Dashboard Summary (`app/services/dashboard_service.py`)**:
   - Unified single-call endpoint (`GET /api/v1/projects/{id}/dashboard`) providing the frontend with all project KPIs, risk severities, progress rates, recent activity feeds, and critical highlights in one request.



