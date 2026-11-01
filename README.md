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
