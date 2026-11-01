import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.models.enums import (
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    ProjectRole,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.knowledge import KnowledgeItem
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.source import Source
from app.models.task import Task
from app.models.user import User
from app.schemas.extraction import ExtractedItem, ExtractionResult
from app.services.evidence_verifier import verify_evidence
from app.services.extraction_service import ExtractionService
from app.services.knowledge_service import knowledge_service


class FakeGeminiClient:
    """Mock Gemini client for deterministic extraction tests."""

    def __init__(self, predefined_items: list[ExtractedItem] | None = None) -> None:
        self.api_key = "fake-test-key"
        self.model_name = "fake-gemini-model"
        self.predefined_items = predefined_items
        self.calls: list[dict[str, Any]] = []

    async def extract_knowledge(
        self,
        chunk_content: str,
        file_path: str,
        location_info: dict[str, Any],
    ) -> ExtractionResult:
        self.calls.append(
            {
                "chunk_content": chunk_content,
                "file_path": file_path,
                "location_info": location_info,
            }
        )
        if self.predefined_items is not None:
            return ExtractionResult(items=self.predefined_items)
        return ExtractionResult(items=[])


# 1. Evidence Verification Tests
def test_evidence_verifier_rules():
    chunk = (
        "# Architecture Overview\n"
        "We have decided to adopt PostgreSQL 17 as the primary transactional database.\n"
        "All database migrations must be applied using Alembic async template."
    )

    # Exact match
    is_v, score, exc = verify_evidence(
        chunk, "We have decided to adopt PostgreSQL 17 as the primary transactional database."
    )
    assert is_v is True
    assert score == 1.0
    assert "PostgreSQL 17" in exc

    # Whitespace and newline variation
    is_v, score, _ = verify_evidence(
        chunk, "We  have   decided to\n adopt PostgreSQL 17  as the primary transactional database."
    )
    assert is_v is True
    assert score >= 0.90

    # Case insensitivity
    is_v, score, _ = verify_evidence(
        chunk, "all database migrations must be applied using alembic async template."
    )
    assert is_v is True
    assert score >= 0.90

    # Hallucinated excerpt (never appeared in chunk)
    is_v, score, _ = verify_evidence(chunk, "We have decided to use MongoDB with Mongoose ORM.")
    assert is_v is False
    assert score < 0.70

    # Very short excerpt (< 8 characters) that doesn't match
    is_v, score, _ = verify_evidence(chunk, "Redis")
    assert is_v is False


# Helper to insert test source, document, and chunk
async def create_test_chunk(
    db: AsyncSession,
    project: Project,
    content: str,
    file_path: str = "docs/architecture.md",
) -> tuple[Document, DocumentChunk]:
    source = Source(
        project_id=project.id,
        name="Docs Source",
        type="upload",
        config={"files": [file_path]},
    )
    db.add(source)
    await db.flush()

    doc = Document(
        project_id=project.id,
        source_id=source.id,
        title=file_path,
        file_path=file_path,
        content_hash=f"hash_{uuid.uuid4().hex[:8]}",
        status="parsed",
        doc_metadata={"file_type": "markdown"},
    )
    db.add(doc)
    await db.flush()

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content=content,
        token_count=len(content.split()),
        location_info={"file_path": file_path, "start_line": 1, "end_line": 10},
    )
    db.add(chunk)
    await db.commit()
    await db.refresh(chunk)
    await db.refresh(doc)
    return doc, chunk


# 2. Knowledge Extraction & Evidence Linking Tests
@pytest.mark.asyncio
async def test_extraction_service_creates_verified_knowledge_and_tasks(
    db_session: AsyncSession,
    project_a: Project,
):
    chunk_text = (
        "We decided to use PostgreSQL 17 for relational storage.\n"
        "Alice must deploy the migrations to staging by 2026-11-20.\n"
        "Risk: Unencrypted secrets could be leaked in logs."
    )
    _, chunk = await create_test_chunk(db_session, project_a, chunk_text)

    mock_items = [
        ExtractedItem(
            category="decision",
            title="Use PostgreSQL 17 for database",
            description="Adopt PostgreSQL 17 for all relational tables.",
            confidence=0.95,
            origin="explicit_fact",
            exact_evidence_excerpt="We decided to use PostgreSQL 17 for relational storage.",
            rationale="Performance and reliability",
        ),
        ExtractedItem(
            category="task",
            title="Deploy migrations to staging",
            description="Alice needs to execute alembic migrations on staging.",
            confidence=0.90,
            origin="explicit_fact",
            exact_evidence_excerpt="Alice must deploy the migrations to staging by 2026-11-20.",
            task_owner="Alice",
            task_due_date="2026-11-20",
        ),
        ExtractedItem(
            category="decision",
            title="Adopt GraphQL for client APIs",
            description="Switched from REST to GraphQL.",
            confidence=0.85,
            origin="ai_inference",
            exact_evidence_excerpt="We fully converted all REST endpoints to GraphQL.",  # Hallucinated!
        ),
    ]

    fake_gemini = FakeGeminiClient(predefined_items=mock_items)
    extraction_service = ExtractionService(gemini_client=fake_gemini)

    stats = await extraction_service.process_project_extraction(
        db=db_session,
        project_id=project_a.id,
    )

    assert stats["extracted_chunks"] == 1
    assert stats["items_created"] == 3
    assert stats["gaps_flagged"] >= 1  # The hallucinated item must be flagged

    # Query KnowledgeItems
    kitems_q = (
        select(KnowledgeItem)
        .where(KnowledgeItem.project_id == project_a.id)
        .order_by(KnowledgeItem.created_at.asc())
    )
    kitems = (await db_session.execute(kitems_q)).scalars().all()
    assert len(kitems) == 3

    # Check verified decision
    item_pg = next(k for k in kitems if "PostgreSQL" in k.title)
    assert item_pg.category == KnowledgeCategory.DECISION
    assert item_pg.origin == KnowledgeOrigin.EXPLICIT_FACT
    assert item_pg.review_status == KnowledgeReviewStatus.PENDING

    # Check Evidence for item_pg
    ev_pg_q = select(Evidence).where(Evidence.knowledge_item_id == item_pg.id)
    ev_pg = (await db_session.execute(ev_pg_q)).scalar_one()
    assert ev_pg.verified is True
    assert ev_pg.chunk_id == chunk.id
    assert "PostgreSQL 17" in ev_pg.exact_excerpt

    # Check relational Task creation
    item_task = next(k for k in kitems if "Deploy migrations" in k.title)
    tasks_q = select(Task).where(Task.knowledge_item_id == item_task.id)
    created_task = (await db_session.execute(tasks_q)).scalar_one()
    assert created_task.title == "Deploy migrations to staging"
    assert created_task.status == TaskStatus.TODO

    # Check unverified / hallucinated item
    item_gql = next(k for k in kitems if "GraphQL" in k.title)
    ev_gql_q = select(Evidence).where(Evidence.knowledge_item_id == item_gql.id)
    ev_gql = (await db_session.execute(ev_gql_q)).scalar_one()
    assert ev_gql.verified is False
    assert "[UNVERIFIED_EVIDENCE]" in (item_gql.review_note or "")

    # Verify chunk was stamped with extraction_version
    await db_session.refresh(chunk)
    assert chunk.extraction_version == settings.EXTRACTION_VERSION


# 3. Deduplication and Evidence Merging Tests
@pytest.mark.asyncio
async def test_extraction_deduplication_and_evidence_merging(
    db_session: AsyncSession,
    project_a: Project,
):
    chunk1_text = "We chose FastAPI as our backend web framework."
    chunk2_text = "As decided in ADR-01, FastAPI is adopted for all backend REST services."
    _, chunk1 = await create_test_chunk(db_session, project_a, chunk1_text, "docs/adr-01.md")
    _, chunk2 = await create_test_chunk(db_session, project_a, chunk2_text, "docs/adr-02.md")

    # Item extracted from chunk 1
    item_chunk1 = ExtractedItem(
        category="decision",
        title="Adopt FastAPI framework",
        description="FastAPI selected for async Python APIs.",
        confidence=0.92,
        origin="explicit_fact",
        exact_evidence_excerpt="We chose FastAPI as our backend web framework.",
    )

    # Near-identical item extracted from chunk 2
    item_chunk2 = ExtractedItem(
        category="decision",
        title="Adopt FastAPI framework",
        description="FastAPI selected for async Python REST services.",
        confidence=0.94,
        origin="explicit_fact",
        exact_evidence_excerpt="FastAPI is adopted for all backend REST services.",
    )

    class MultiChunkFakeGemini:
        def __init__(self) -> None:
            self.api_key = "fake-key"
            self.model_name = "fake-model"

        async def extract_knowledge(
            self, chunk_content: str, file_path: str, location_info: dict
        ) -> ExtractionResult:
            if "adr-01" in file_path:
                return ExtractionResult(items=[item_chunk1])
            return ExtractionResult(items=[item_chunk2])

    extraction_service = ExtractionService(gemini_client=MultiChunkFakeGemini())
    stats = await extraction_service.process_project_extraction(db_session, project_a.id)

    assert stats["items_created"] == 1
    assert stats["evidences_merged"] == 1

    # Verify that only ONE KnowledgeItem exists
    kitems = (
        (
            await db_session.execute(
                select(KnowledgeItem).where(KnowledgeItem.project_id == project_a.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(kitems) == 1
    single_item = kitems[0]

    # Verify that TWO Evidence records point to this single KnowledgeItem
    evidences = (
        (
            await db_session.execute(
                select(Evidence).where(Evidence.knowledge_item_id == single_item.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(evidences) == 2
    assert {e.chunk_id for e in evidences} == {chunk1.id, chunk2.id}
    assert all(e.verified for e in evidences)


# 4. Conflicting Decisions Flagging Test
@pytest.mark.asyncio
async def test_conflicting_decisions_flagged(
    db_session: AsyncSession,
    project_a: Project,
):
    chunk1_text = "We will use Redis for our distributed session caching layer."
    chunk2_text = "Security review determined we must avoid Redis and keep cache in-memory."
    await create_test_chunk(db_session, project_a, chunk1_text, "docs/decision_a.md")
    await create_test_chunk(db_session, project_a, chunk2_text, "docs/decision_b.md")

    item1 = ExtractedItem(
        category="decision",
        title="Distributed caching strategy",
        description="We will use Redis for session caching.",
        confidence=0.90,
        origin="explicit_fact",
        exact_evidence_excerpt="We will use Redis for our distributed session caching layer.",
        rationale="Speed and clustering",
    )
    item2 = ExtractedItem(
        category="decision",
        title="Distributed caching strategy alternative",
        description="We must avoid Redis due to compliance constraints.",
        confidence=0.90,
        origin="explicit_fact",
        exact_evidence_excerpt="Security review determined we must avoid Redis and keep cache in-memory.",
        rationale="Compliance",
    )

    class ConflictFakeGemini:
        def __init__(self) -> None:
            self.api_key = "fake-key"
            self.model_name = "fake-model"

        async def extract_knowledge(
            self, chunk_content: str, file_path: str, location_info: dict
        ) -> ExtractionResult:
            if "decision_a" in file_path:
                return ExtractionResult(items=[item1])
            return ExtractionResult(items=[item2])

    extraction_service = ExtractionService(gemini_client=ConflictFakeGemini())
    stats = await extraction_service.process_project_extraction(db_session, project_a.id)

    assert stats["conflicts_flagged"] >= 1

    # Check conflicts in database
    conflicts = await knowledge_service.list_project_conflicts(db_session, project_a.id)
    assert len(conflicts) >= 1
    assert "CONFLICT_DETECTED" in conflicts[0].conflict_note


# 5. Idempotent Re-Extraction Test
@pytest.mark.asyncio
async def test_extraction_idempotency(
    db_session: AsyncSession,
    project_a: Project,
):
    chunk_text = "We adopt Docker Compose for local development environment orchestration."
    _, chunk = await create_test_chunk(db_session, project_a, chunk_text)

    item = ExtractedItem(
        category="decision",
        title="Use Docker Compose locally",
        description="Orchestrate PostgreSQL and Qdrant locally.",
        confidence=0.95,
        origin="explicit_fact",
        exact_evidence_excerpt="We adopt Docker Compose for local development environment orchestration.",
    )
    fake_gemini = FakeGeminiClient(predefined_items=[item])
    extraction_service = ExtractionService(gemini_client=fake_gemini)

    # First run: extracts chunk
    first_res = await extraction_service.process_project_extraction(db_session, project_a.id)
    assert first_res["extracted_chunks"] == 1
    assert first_res["items_created"] == 1

    # Second run: chunk is already at EXTRACTION_VERSION, must skip
    second_res = await extraction_service.process_project_extraction(db_session, project_a.id)
    assert second_res["extracted_chunks"] == 0
    assert second_res["items_created"] == 0
    assert len(fake_gemini.calls) == 1  # No additional Gemini API calls burned!


# 6. Knowledge Item Review & Role Permissions Test
@pytest.mark.asyncio
async def test_knowledge_review_permissions_and_audit(
    client: AsyncClient,
    db_session: AsyncSession,
    project_a: Project,
    user_a: User,
    auth_headers_a: dict[str, str],
    user_b: User,
    auth_headers_b: dict[str, str],
):
    # Create knowledge item
    kitem = KnowledgeItem(
        project_id=project_a.id,
        category=KnowledgeCategory.DECISION,
        title="Choose AsyncPG driver",
        description="Use asyncpg for high performance async PostgreSQL connection pool.",
        confidence=0.90,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    db_session.add(kitem)
    await db_session.commit()
    await db_session.refresh(kitem)

    # User B is NOT in project_a yet -> 403 Forbidden
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/knowledge/{kitem.id}/review",
        headers=auth_headers_b,
        json={"review_status": "approved", "review_note": "Looks good"},
    )
    assert resp.status_code == 403

    # Add User B with role MEMBER -> 403 Forbidden (requires REVIEWER or higher)
    member_b = ProjectMember(
        project_id=project_a.id,
        user_id=user_b.id,
        role=ProjectRole.MEMBER,
    )
    db_session.add(member_b)
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/knowledge/{kitem.id}/review",
        headers=auth_headers_b,
        json={"review_status": "approved", "review_note": "Looks good"},
    )
    assert resp.status_code == 403

    # Promote User B to REVIEWER -> succeeds 200 OK
    member_b.role = ProjectRole.REVIEWER
    await db_session.commit()

    review_payload = {
        "review_status": "approved",
        "review_note": "Verified by reviewer Bob",
        "title": "Choose AsyncPG driver for SQLAlchemy 2.0",
    }
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/knowledge/{kitem.id}/review",
        headers=auth_headers_b,
        json=review_payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "approved"
    assert "Verified by reviewer Bob" in data["review_note"]
    assert data["reviewer_id"] == str(user_b.id)
    assert data["reviewed_at"] is not None
    assert data["title"] == "Choose AsyncPG driver for SQLAlchemy 2.0"


# 7. Knowledge APIs: Filtering, Tasks, Gaps, and Bulk Review
@pytest.mark.asyncio
async def test_knowledge_api_filters_gaps_and_bulk_review(
    client: AsyncClient,
    db_session: AsyncSession,
    project_a: Project,
    user_a: User,
    auth_headers_a: dict[str, str],
):
    # Create multiple items with evidence and gaps
    item1 = KnowledgeItem(
        project_id=project_a.id,
        category=KnowledgeCategory.DECISION,
        title="PostgreSQL 17 Database Choice",
        description="Adopt PostgreSQL 17.",
        confidence=0.95,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    item2 = KnowledgeItem(
        project_id=project_a.id,
        category=KnowledgeCategory.TASK,
        title="Setup CI workflow",
        description="Configure GitHub Actions CI.",
        confidence=0.85,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
        review_status=KnowledgeReviewStatus.PENDING,
        review_note="[GAP: Task missing owner or due date]",
    )
    db_session.add_all([item1, item2])
    await db_session.flush()

    ev1 = Evidence(
        project_id=project_a.id,
        knowledge_item_id=item1.id,
        source_locator="README.md",
        exact_excerpt="PostgreSQL 17",
        verified=True,
        confidence=1.0,
    )
    ev2 = Evidence(
        project_id=project_a.id,
        knowledge_item_id=item2.id,
        source_locator="README.md",
        exact_excerpt="CI workflow",
        verified=False,
        confidence=0.5,
    )
    task2 = Task(
        project_id=project_a.id,
        knowledge_item_id=item2.id,
        title="Setup CI workflow",
        status=TaskStatus.TODO,
    )
    db_session.add_all([ev1, ev2, task2])
    await db_session.commit()

    # 1. Filter by category
    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/knowledge?category=decision",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "PostgreSQL 17 Database Choice"

    # 2. Filter by verified flag
    resp_v = await client.get(
        f"/api/v1/projects/{project_a.id}/knowledge?verified=true",
        headers=auth_headers_a,
    )
    assert resp_v.status_code == 200
    v_items = resp_v.json()
    assert len(v_items) == 1
    assert v_items[0]["id"] == str(item1.id)

    # 3. Text search
    resp_q = await client.get(
        f"/api/v1/projects/{project_a.id}/knowledge?q=GitHub",
        headers=auth_headers_a,
    )
    assert resp_q.status_code == 200
    q_items = resp_q.json()
    assert len(q_items) == 1
    assert q_items[0]["id"] == str(item2.id)

    # 4. Detail endpoint
    resp_detail = await client.get(
        f"/api/v1/projects/{project_a.id}/knowledge/{item2.id}",
        headers=auth_headers_a,
    )
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert len(detail["evidences"]) == 1
    assert len(detail["tasks"]) == 1
    assert detail["tasks"][0]["title"] == "Setup CI workflow"

    # 5. List Tasks endpoint
    resp_tasks = await client.get(
        f"/api/v1/projects/{project_a.id}/tasks",
        headers=auth_headers_a,
    )
    assert resp_tasks.status_code == 200
    tasks_list = resp_tasks.json()
    assert len(tasks_list) == 1
    assert tasks_list[0]["title"] == "Setup CI workflow"

    # 6. List Gaps endpoint
    resp_gaps = await client.get(
        f"/api/v1/projects/{project_a.id}/gaps",
        headers=auth_headers_a,
    )
    assert resp_gaps.status_code == 200
    gaps_list = resp_gaps.json()
    assert len(gaps_list) >= 1
    assert any(g["gap_type"] == "missing_task_owner_or_date" for g in gaps_list)

    # 7. Bulk review endpoint
    resp_bulk = await client.post(
        f"/api/v1/projects/{project_a.id}/knowledge/bulk-review",
        headers=auth_headers_a,
        json={
            "item_ids": [str(item1.id), str(item2.id)],
            "review_status": "approved",
            "review_note": "Batch approved by team lead",
        },
    )
    assert resp_bulk.status_code == 200
    bulk_data = resp_bulk.json()
    assert bulk_data["updated_count"] == 2
    assert bulk_data["review_status"] == "approved"
