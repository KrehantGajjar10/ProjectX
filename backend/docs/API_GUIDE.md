# ProjectX Backend API Guide & Frontend Integration Contract

**Audience**: Frontend Engineers (Krehant & Frontend Team)  
**Base URL**: `http://localhost:8000/api/v1`  
**OpenAPI Specification**: `backend/docs/openapi.json`  
**Interactive Swagger UI**: `http://localhost:8000/api/v1/docs`  
**ReDoc Documentation**: `http://localhost:8000/api/v1/redoc`  

---

## 1. Authentication & Security

All private endpoints require Bearer Token authentication via standard HTTP `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### Standard User Authentication Flow

1. **Register**: `POST /api/v1/auth/register`
   - Request: `{"email": "user@example.com", "password": "SecurePassword123!", "full_name": "Alice Chen"}`
   - Returns: Created User profile (`id`, `email`, `full_name`, `is_active`).

2. **Login**: `POST /api/v1/auth/login`
   - Form-data or JSON: `{"username": "demo@projectx.dev", "password": "DemoUser123!"}`
   - Returns:
     ```json
     {
       "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "token_type": "bearer",
       "user": {
         "id": "0de0869c-a0f7-47fd-9c80-74440d8fbb20",
         "email": "demo@projectx.dev",
         "full_name": "Dave Miller",
         "is_active": true
       }
     }
     ```

3. **Current Profile**: `GET /api/v1/auth/me`
   - Returns authenticated user details and active project memberships.

### Project Membership & Role-Based Access Control (RBAC)

Every project operation is authorized against the caller's membership role within that specific project:

| Role | Rank | Permissions |
| :--- | :--- | :--- |
| **`viewer`** | 1 | Read project metadata, search, Q&A, graph, timeline, risks, handover reports. |
| **`member`** | 2 | Upload documents, enqueue ingestion/extraction jobs, trigger handover generation. |
| **`reviewer`**| 3 | Review and approve/reject extracted knowledge items and handover reports. |
| **`admin`** | 4 | Connect GitHub repos, delete sources, reindex vectors, manage members. |
| **`owner`** | 5 | Complete project administration, ownership transfer, project deletion. |

---

## 2. Main End-to-End User Flow (In Endpoint Order)

ProjectX turns scattered engineering knowledge into an evidence-linked handover report across 5 distinct stages:

```
[Connect] ──> [Reconstruct] ──> [Verify] ──> [Understand] ──> [Handover]
 Sources        Parsing           Evidence       Graph/Q&A        Verified Plan
```

### Stage 1: Connect (Source Onboarding)

1. **Create Project**:
   ```http
   POST /api/v1/projects
   Content-Type: application/json

   {
     "name": "Chronos Workflow Engine",
     "description": "High-throughput distributed workflow engine."
   }
   ```

2. **Connect GitHub Source (Admin+)**:
   ```http
   POST /api/v1/projects/{project_id}/sources/github
   Content-Type: application/json

   {
     "repo_url": "https://github.com/my-org/chronos",
     "branch": "main",
     "access_token": "ghp_optionalTokenOverride"
   }
   ```

3. **Upload Documents (Member+)**:
   ```http
   POST /api/v1/projects/{project_id}/sources/upload
   Content-Type: multipart/form-data

   files: <binary PDF, Markdown, DOCX, PPTX, or code files>
   ```
   *Allowed extensions*: `.pdf`, `.md`, `.markdown`, `.docx`, `.pptx`, `.txt`, `.py`, `.ts`, `.js`, `.json`, `.yaml`, `.yml`  
   *Max upload size*: 25 MB per file.

4. **List Project Sources**:
   ```http
   GET /api/v1/projects/{project_id}/sources
   ```

---

### Stage 2: Reconstruct (Processing & Chunking)

1. **Trigger Ingestion Job (Member+)**:
   ```http
   POST /api/v1/projects/{project_id}/ingestion/jobs
   Content-Type: application/json

   {
     "source_ids": ["cb07f94b-4f6a-4d62-9cc1-6b237712f1a8"]
   }
   ```
   Returns HTTP 201 with `IngestionJobRead`:
   ```json
   {
     "id": "e9b23b18-b80c-4384-91b6-d2495b41051c",
     "project_id": "2408a2b8-a00c-43e0-b0f9-b9c317516a22",
     "status": "queued",
     "progress_percentage": 0,
     "created_at": "2026-11-02T07:29:46.000Z"
   }
   ```

2. **Poll Ingestion Progress**:
   ```http
   GET /api/v1/projects/{project_id}/ingestion/jobs
   ```
   Poll every 2.0 seconds until `status` is `completed` (or `failed`).

---

### Stage 3: Verify (AI Knowledge Extraction & Evidence Linking)

The extraction worker parses document chunks, invokes Gemini structured extraction, and verifies evidence substrings programmatically.

1. **List Extracted Knowledge Items**:
   ```http
   GET /api/v1/projects/{project_id}/knowledge?category=decision&review_status=approved&page=1&page_size=20
   ```

2. **Get Detailed Knowledge Item with Evidence**:
   ```http
   GET /api/v1/projects/{project_id}/knowledge/{item_id}
   ```
   Response payload:
   ```json
   {
     "id": "a5c9affe-b490-4020-b6ce-b089eae18499",
     "project_id": "2408a2b8-a00c-43e0-b0f9-b9c317516a22",
     "category": "decision",
     "title": "PostgreSQL 17 for Relational Persistence and DAG Traversal",
     "description": "Selected PostgreSQL 17 with asyncpg for system of record and recursive CTEs.",
     "confidence": 0.98,
     "origin": "explicit_fact",
     "review_status": "approved",
     "evidences": [
       {
         "id": "5c9b1f09-b132-4752-bfbc-87747e92383c",
         "source_locator": "docs/ARCHITECTURE.md#chunk-0",
         "exact_excerpt": "We selected PostgreSQL 17 with asyncpg as the primary relational system of record.",
         "confidence": 0.98,
         "verified": true,
         "document_title": "ARCHITECTURE.md"
       }
     ]
   }
   ```

3. **Review Knowledge Item (Reviewer+)**:
   ```http
   POST /api/v1/projects/{project_id}/knowledge/{item_id}/review
   Content-Type: application/json

   {
     "review_status": "approved",
     "review_note": "Verified with tech lead; accurate architectural decision."
   }
   ```

---

### Stage 4: Understand (Retrieval, Graph, Risks, Timeline)

1. **Contextual Q&A & Semantic Search**:
   ```http
   POST /api/v1/projects/{project_id}/search
   Content-Type: application/json

   {
     "question": "Why did we choose PostgreSQL and what are the known risks?",
     "include_answer": true,
     "top_k": 5
   }
   ```
   Returns grounded LLM answer with verifiable inline citations:
   ```json
   {
     "answer": "We selected PostgreSQL 17 for relational integrity and recursive DAG queries [1]. The primary known risk is the legacy compiler's single point of knowledge [2].",
     "citations": [
       {
         "citation_number": 1,
         "knowledge_item_id": "a5c9affe-b490-4020-b6ce-b089eae18499",
         "title": "PostgreSQL 17 for Relational Persistence and DAG Traversal",
         "exact_excerpt": "We selected PostgreSQL 17 with asyncpg as the primary relational system of record.",
         "source_locator": "docs/ARCHITECTURE.md#chunk-0",
         "confidence": 0.98
       }
     ],
     "retrieval_mode": "hybrid",
     "is_sufficient": true
   }
   ```

2. **Dependency Graph API**:
   ```http
   GET /api/v1/projects/{project_id}/dependencies/graph?category=decision
   ```
   Returns `nodes` and `edges` ready for frontend graph visualizers (Cytoscape / React Flow / D3), including:
   - Circular dependency detection findings.
   - Blocked chain paths (items blocked by incomplete or high-risk tasks).

3. **Risk Detection Matrix**:
   ```http
   GET /api/v1/projects/{project_id}/risks
   ```
   Returns combined risks (extracted risks + computed signals: overdue tasks, unassigned tasks, single point of knowledge).

4. **Project Timeline**:
   ```http
   GET /api/v1/projects/{project_id}/timeline
   ```
   Returns chronologically sorted milestones, releases, and key events.

5. **Project Activity Audit Feed**:
   ```http
   GET /api/v1/projects/{project_id}/activity?limit=25
   ```
   Returns chronological audit logs for source uploads, knowledge reviews, and handover reports.

---

### Stage 5: Handover (Report Generation, Sign-off & Export)

1. **Trigger Handover Report Generation (Member+)**:
   ```http
   POST /api/v1/projects/{project_id}/handover
   Content-Type: application/json

   {
     "departing_member_name": "Dave Miller",
     "focus_area": "Core Architecture & Legacy Compiler",
     "approved_only": false
   }
   ```
   Returns HTTP 202 Accepted with background job ID for polling.

2. **Fetch Latest Handover Report**:
   ```http
   GET /api/v1/projects/{project_id}/handover
   ```
   Returns `LatestHandoverResponse` with:
   - `status`: `draft` | `in_review` | `approved` | `rejected`
   - `sections`: 10 evidence-linked sections:
     1. `project_overview`
     2. `completed_work`
     3. `pending_tasks`
     4. `key_decisions`
     5. `risks_and_mitigations`
     6. `dependencies_critical_paths`
     7. `knowledge_gaps_questions`
     8. `unresolved_conflicts`
     9. `actionable_continuation_plan`
     10. `departing_context_who_to_ask`
   - `validation_summary`: total claims, verified claims, dropped unverified claims.

3. **Review & Approve Handover Report (Reviewer+)**:
   ```http
   POST /api/v1/projects/{project_id}/handover/{report_id}/review
   Content-Type: application/json

   {
     "status": "approved",
     "review_comment": "Final handover approved by engineering director."
   }
   ```
   > [!IMPORTANT]
   > Once a handover report status reaches `approved`, it becomes **immutable**. Any future regeneration creates version `version + 1`.

4. **Export Handover Report**:
   - **Markdown**: `GET /api/v1/projects/{project_id}/handover/{report_id}/export/markdown`  
     *Content-Type: text/markdown*
   - **PDF**: `GET /api/v1/projects/{project_id}/handover/{report_id}/export/pdf`  
     *Content-Type: application/pdf*
   - **Word DOCX**: `GET /api/v1/projects/{project_id}/handover/{report_id}/export/docx`  
     *Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document*

---

## 3. Enumerations & Value Reference

| Enum Type | Values | Description |
| :--- | :--- | :--- |
| **`ProjectRole`** | `viewer`, `member`, `reviewer`, `admin`, `owner` | Member permission levels |
| **`IngestionJobStatus`** | `queued`, `processing`, `completed`, `failed` | Asynchronous worker progress |
| **`KnowledgeCategory`** | `decision`, `task`, `risk`, `milestone`, `insight`, `dependency` | Domain knowledge classification |
| **`KnowledgeReviewStatus`** | `pending`, `approved`, `rejected` | Curation status for insights |
| **`KnowledgeOrigin`** | `explicit_fact`, `ai_inference` | Fact vs AI reasoned deduction |
| **`TaskStatus`** | `todo`, `in_progress`, `completed`, `blocked`, `cancelled` | Execution state of work items |
| **`HandoverReportStatus`** | `draft`, `in_review`, `approved`, `rejected` | Handover report review lifecycle |

---

## 4. How Evidence & Citations are Structured

Every insight in ProjectX must cite an exact excerpt from a source document.

### Citation Schema
```json
{
  "item_id": "a5c9affe-b490-4020-b6ce-b089eae18499",
  "title": "PostgreSQL 17 for Relational Persistence and DAG Traversal",
  "document_title": "ARCHITECTURE.md",
  "source_locator": "docs/ARCHITECTURE.md#chunk-0",
  "exact_excerpt": "We selected PostgreSQL 17 with asyncpg as the primary relational system of record.",
  "confidence": 0.98,
  "verified": true
}
```

### Frontend Rendering Advice
- Render claim statements as primary text.
- Attach an interactive pill or link for each citation number `[1]`.
- Clicking `[1]` can open a drawer or popover displaying the `exact_excerpt`, `document_title`, and `source_locator`, allowing engineers to verify claims against original sources.

---

## 5. Standard Error Handling & Rate Limiting

ProjectX returns consistent, typed JSON error envelopes on all failures:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before retrying.",
    "details": {
      "retry_after_seconds": 60
    }
  }
}
```

### Common HTTP Status Codes

| HTTP Status | Error Code | Meaning / Resolution |
| :--- | :--- | :--- |
| **400 Bad Request** | `BAD_REQUEST` | Malformed parameters, unsupported file extension, or file too large. |
| **401 Unauthorized** | `AUTHENTICATION_FAILED` | Missing, invalid, or expired Bearer token. Redirect to login. |
| **403 Forbidden** | `PERMISSION_DENIED` | User lacks sufficient project role (e.g. `viewer` attempting `upload`). |
| **404 Not Found** | `NOT_FOUND` | Project, document, knowledge item, or report does not exist. |
| **409 Conflict** | `CONFLICT` | Resource collision (e.g. email already registered). |
| **422 Unprocessable** | `VALIDATION_ERROR` | Schema validation failed; inspect `details` array for field errors. |
| **429 Too Many Req** | `RATE_LIMIT_EXCEEDED` | Request limit hit on expensive endpoints (`/search`, `/handover`). Inspect `Retry-After` header. |
| **500 Server Error** | `INTERNAL_SERVER_ERROR` | Unhandled internal exception; correlate using `X-Request-ID` header. |

### Correlation & Tracing
Every HTTP response carries the header:
```http
X-Request-ID: 7a83d31e9ab74235b6fa1482e9871df4
X-Process-Time-Ms: 12.45
```
Supply `X-Request-ID` when reporting issues to backend engineers for instant log correlation.

---

## 6. Mock-Friendly Development (Demo Mode)

To develop or demo the frontend without setting up a Google Gemini API key:

1. Enable demo mode in the backend `.env`:
   ```bash
   DEMO_MODE=true
   ```
2. When `DEMO_MODE=true`, the backend returns realistic canned AI responses for all extraction, contextual Q&A, and handover generation calls.
3. All demo data is explicitly prefixed with `[DEMO_MODE]`.
4. When `DEMO_MODE=false`, the server strictly requires a valid `GEMINI_API_KEY` and never silently falls back to synthetic mock data.

---

## 7. Fast Demo Quickstart (For Frontend Devs)

Run the backend seed script to populate a rich demo workspace in 3 seconds:

```bash
cd backend
uv run python -m scripts.seed_demo
```

Use the generated demo account:
- **Email**: `demo@projectx.dev`
- **Password**: `DemoUser123!`
- **Project**: "Chronos Workflow Engine" (pre-seeded with 4 docs, 6 verified knowledge items, blocked tasks, risks, and an approved Handover Report).
