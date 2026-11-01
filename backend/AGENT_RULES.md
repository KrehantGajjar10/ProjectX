# ProjectX Backend Agent Rules & Architecture Guidelines

This document outlines the strict behavioral rules, technology stack, and architectural layering conventions for ProjectX backend development. All AI agents and developers working on this codebase must adhere strictly to these rules across every session.

---

## 1. Hard Rules (Non-Negotiable)

1. **NEVER Run Any Git Command**:
   - Absolutely no `git init`, `git add`, `git commit`, `git push`, `git pull`, `git branch`, `git stash`, `git checkout`, `git reset`, etc.
   - Do not create or modify any file inside `.git`.
   - If a task seems to require git, skip the git step and inform the user instead.

2. **Zero Hardcoded Secrets**:
   - Never embed credentials, secrets, tokens, or private keys into source code.
   - All configurations must be sourced through environment variables via `app.core.config.Settings`.
   - Always keep `backend/.env.example` in sync with any newly introduced configuration variable.
   - Ensure `.gitignore` continuously excludes `.env` and sensitive files.

3. **Strict File Scope Boundaries**:
   - Do not install or generate any files outside the `backend/` folder and the root `docker-compose.yml`, `README.md`, and `.gitignore`.
   - Do not generate frontend code in this project repository.

4. **Self-Verification Requirement**:
   - Before completing any task or prompt, execute the application and the test suite yourself.
   - Run linter/formatting checks (`ruff check`).
   - Report actual, verified execution outputs—never report assumed or simulated results.

---

## 2. Technology Stack

- **Runtime & Language**: Python 3.12
- **Framework**: FastAPI (async) with Uvicorn
- **Package & Dependency Manager**: `uv` (use `uv add`, `uv run`)
- **Primary Database**: PostgreSQL 17
- **Database ORM & Driver**: SQLAlchemy 2.0 (async) with `asyncpg`
- **Schema Migrations**: Alembic (async template wired to `Base.metadata` and dynamic config)
- **Validation & Settings**: Pydantic v2 & `pydantic-settings`
- **Security & Passwords**: Argon2id password hashing via `pwdlib[argon2]`, JWT access tokens via `pyjwt[crypto]`
- **HTTP Client**: `httpx` (async)
- **LLM Integration**: Gemini via the official `google-genai` SDK
- **Vector Database**: Qdrant (`qdrant-client` async)
- **Graph Database**: Neo4j (`neo4j` async driver) – **OPTIONAL**, disabled by default behind compose profile
- **Testing & Quality**: `pytest`, `pytest-asyncio`, `ruff`
- **Containerization**: Docker & Docker Compose v2

---

## 3. Architecture Layering & Separation of Concerns

ProjectX backend is structured as a **modular monolith** under `backend/app/` with strict boundaries:

```
backend/app/
├── core/          # Application configuration, security utilities, global exceptions & handlers
├── db/            # Base declarative models, session management, DB engine
├── models/        # SQLAlchemy 2.0 database models
├── schemas/       # Pydantic v2 validation and serialization schemas
├── api/v1/        # HTTP presentation layer (routers, endpoints, dependency injection)
├── services/      # Core business logic and database transaction orchestration
├── integrations/  # External service adapters (Gemini, GitHub, Qdrant, Neo4j)
├── processors/    # File parsing, document chunking, location extraction
└── workers/       # Background tasks and async job execution routines
```

### Strict Architectural Boundaries:

1. **Endpoints (`app/api/`)**:
   - Only handle HTTP protocol concerns: query/path/body parsing, status codes, and dependency resolution.
   - Must delegate all business logic to `app/services/`.
   - Must enforce authorization using reusable dependencies like `require_project_role`.

2. **Services (`app/services/`)**:
   - Encapsulate all business logic, workflow rules, and database operations.
   - Orchestrate calls between models, processors, and integrations.

3. **Integrations (`app/integrations/`)**:
   - Only communicate with external third-party systems (GitHub API, Gemini API, Qdrant vector database, Neo4j graph database).
   - **NEVER write directly to the relational database**. Any database persistence of results must be handled by the calling service.

4. **Processors (`app/processors/`)**:
   - Pure compute utilities for content transformation (parsing text, Markdown, code, calculating SHA-256 hashes, generating line/page location metadata).

5. **Database Models & Migrations (`app/models/`, `alembic/`)**:
   - All primary keys must be UUIDs.
   - Every entity must include `created_at` and `updated_at` timezone-aware timestamps.
   - Use sensible foreign keys with explicit cascade behaviors (`CASCADE`, `SET NULL`).
   - **Never run `Base.metadata.create_all` at startup in production**; database schema changes must only be applied through Alembic migrations.
   - **Evidence must remain a first-class entity** linking knowledge items to documents, chunks, and exact source locators (never a JSON blob embedded in KnowledgeItem).
