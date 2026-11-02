import uuid
from io import BytesIO
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.models.enums import (
    HandoverReportStatus,
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.handover import HandoverReport
from app.models.knowledge import KnowledgeItem
from app.models.task import Task


@pytest.mark.asyncio
async def test_full_projectx_e2e_lifecycle(client: AsyncClient, db_session: AsyncSession) -> None:
    """Comprehensive E2E test covering the complete 5-stage ProjectX workflow:

    1. Register & Login
    2. Project Creation & Member RBAC
    3. Document Upload
    4. Ingestion & Chunking
    5. Knowledge Extraction & Evidence Verification
    6. Review & Approval Curation
    7. Contextual Grounded Search & Citations
    8. Dependency Graph & Risk Detection
    9. Handover Report Generation, Approval, Immutability & Multi-Format Exports
    10. Activity Audit Trail Verification
    """

    # =========================================================================
    # Step 1: User Registration & Authentication
    # =========================================================================
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_engineer@projectx.dev",
            "password": "Password123!",
            "full_name": "E2E Lead Engineer",
        },
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "e2e_engineer@projectx.dev"

    # Login to acquire Bearer JWT
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "e2e_engineer@projectx.dev",
            "password": "Password123!",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify Current Profile
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "e2e_engineer@projectx.dev"

    # =========================================================================
    # Step 2: Project Creation & Ownership
    # =========================================================================
    proj_res = await client.post(
        "/api/v1/projects/",
        headers=headers,
        json={
            "name": "E2E Distributed Gateway",
            "description": "High-throughput API gateway with evidence-linked routing.",
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # Verify project list returns project with role=owner
    my_projs = await client.get("/api/v1/projects/", headers=headers)
    assert my_projs.status_code == 200
    assert any(p["id"] == project_id for p in my_projs.json())

    # =========================================================================
    # Step 3: Source Upload (Connect Stage)
    # =========================================================================
    readme_content = (
        b"# Gateway Architecture\n\n"
        b"We selected Redis and PostgreSQL 17 for persistent rate-limit tracking.\n"
        b"Task: Alice to implement JWT validation filter.\n"
        b"Risk: Gateway proxy memory exhaustion under peak traffic.\n"
    )

    files = [
        (
            "files",
            ("README.md", BytesIO(readme_content), "text/markdown"),
        )
    ]
    upload_res = await client.post(
        f"/api/v1/projects/{project_id}/sources/upload",
        headers=headers,
        files=files,
    )
    assert upload_res.status_code == 201
    upload_json = upload_res.json()
    source_id = upload_json["source"]["id"]
    assert len(upload_json["files"]) == 1

    # Verify sources list
    sources_res = await client.get(
        f"/api/v1/projects/{project_id}/sources",
        headers=headers,
    )
    assert sources_res.status_code == 200
    assert len(sources_res.json()) >= 1

    # =========================================================================
    # Step 4: Ingestion & Document Chunking (Reconstruct Stage)
    # =========================================================================
    job_res = await client.post(
        f"/api/v1/projects/{project_id}/ingestion/jobs",
        headers=headers,
        json={"source_ids": [source_id]},
    )
    assert job_res.status_code == 201
    assert "id" in job_res.json()

    # Ingest document directly into db for testing pipeline continuity
    doc = Document(
        project_id=uuid.UUID(project_id),
        source_id=uuid.UUID(source_id),
        file_path="README.md",
        title="README.md",
        content_hash="abc123hash",
        mime_type="text/markdown",
        raw_content=readme_content.decode("utf-8"),
        status="parsed",
    )
    db_session.add(doc)
    await db_session.flush()

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content=readme_content.decode("utf-8"),
        token_count=35,
        location_info={"file_path": "README.md", "start_line": 1, "end_line": 6},
    )
    db_session.add(chunk)
    await db_session.flush()

    # =========================================================================
    # Step 5: Knowledge Extraction & First-Class Evidence (Verify Stage)
    # =========================================================================
    k_decision = KnowledgeItem(
        project_id=uuid.UUID(project_id),
        category=KnowledgeCategory.DECISION,
        title="PostgreSQL 17 for Persistent Rate-Limit Tracking",
        description="Selected PostgreSQL 17 with asyncpg for durable state persistence.",
        confidence=0.97,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    k_task = KnowledgeItem(
        project_id=uuid.UUID(project_id),
        category=KnowledgeCategory.TASK,
        title="Implement JWT Validation Filter",
        description="Scaffold authentication middleware for token parsing.",
        confidence=0.95,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    k_risk = KnowledgeItem(
        project_id=uuid.UUID(project_id),
        category=KnowledgeCategory.RISK,
        title="Gateway Proxy Memory Exhaustion",
        description="Under high concurrency, unbounded buffering risks container OOM.",
        confidence=0.91,
        origin=KnowledgeOrigin.AI_INFERENCE,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    db_session.add_all([k_decision, k_task, k_risk])
    await db_session.flush()

    # Add verified first-class Evidence
    ev1 = Evidence(
        project_id=uuid.UUID(project_id),
        knowledge_item_id=k_decision.id,
        document_id=doc.id,
        chunk_id=chunk.id,
        source_locator="README.md#chunk-0",
        exact_excerpt="We selected Redis and PostgreSQL 17 for persistent rate-limit tracking.",
        confidence=0.97,
        verified=True,
    )
    ev2 = Evidence(
        project_id=uuid.UUID(project_id),
        knowledge_item_id=k_risk.id,
        document_id=doc.id,
        chunk_id=chunk.id,
        source_locator="README.md#chunk-0",
        exact_excerpt="Risk: Gateway proxy memory exhaustion under peak traffic.",
        confidence=0.91,
        verified=True,
    )
    db_session.add_all([ev1, ev2])
    await db_session.flush()

    # Add concrete Task entity
    t_ent = Task(
        project_id=uuid.UUID(project_id),
        title="Implement JWT Validation Filter",
        description="Authentication filter in core/middleware.py",
        status=TaskStatus.IN_PROGRESS,
        priority="high",
        knowledge_item_id=k_task.id,
    )
    db_session.add(t_ent)
    await db_session.flush()
    await db_session.commit()

    # =========================================================================
    # Step 6: Review & Approval
    # =========================================================================
    review_res = await client.post(
        f"/api/v1/projects/{project_id}/knowledge/{k_decision.id}/review",
        headers=headers,
        json={
            "review_status": "approved",
            "review_note": "Verified architecture decision with lead.",
        },
    )
    assert review_res.status_code == 200
    assert review_res.json()["review_status"] == "approved"

    # List knowledge items with filter
    k_list = await client.get(
        f"/api/v1/projects/{project_id}/knowledge?review_status=approved",
        headers=headers,
    )
    assert k_list.status_code == 200
    items = k_list.json()
    assert any(it["id"] == str(k_decision.id) for it in items)

    # =========================================================================
    # Step 7: Retrieval & Grounded Search (Understand Stage)
    # =========================================================================
    # 7a. Plain ranked keyword search (no LLM generation)
    plain_search = await client.post(
        f"/api/v1/projects/{project_id}/search",
        headers=headers,
        json={
            "question": "PostgreSQL",
            "include_answer": False,
        },
    )
    assert plain_search.status_code == 200
    assert plain_search.json()["total_results"] >= 1

    # 7b. Reindex vectors and Contextual Grounded Q&A with Demo Mode
    with patch("app.core.config.settings.DEMO_MODE", True):
        reindex_res = await client.post(
            f"/api/v1/projects/{project_id}/reindex",
            headers=headers,
        )
        assert reindex_res.status_code == 200

        search_res = await client.post(
            f"/api/v1/projects/{project_id}/search",
            headers=headers,
            json={
                "question": "PostgreSQL persistent rate-limit tracking",
                "include_answer": True,
            },
        )
        assert search_res.status_code == 200
        assert "[DEMO_MODE]" in search_res.json()["answer"]

    # =========================================================================
    # Step 8: Dependency Graph, Risks & Timeline
    # =========================================================================
    graph_res = await client.get(
        f"/api/v1/projects/{project_id}/dependencies/graph",
        headers=headers,
    )
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data

    risks_res = await client.get(
        f"/api/v1/projects/{project_id}/risks",
        headers=headers,
    )
    assert risks_res.status_code == 200
    assert len(risks_res.json()["risks"]) >= 1

    timeline_res = await client.get(
        f"/api/v1/projects/{project_id}/timeline",
        headers=headers,
    )
    assert timeline_res.status_code == 200
    assert "events" in timeline_res.json()

    dashboard_res = await client.get(
        f"/api/v1/projects/{project_id}/dashboard",
        headers=headers,
    )
    assert dashboard_res.status_code == 200
    assert sum(dashboard_res.json()["items_by_category"].values()) >= 1

    # =========================================================================
    # Step 9: Handover Report Creation, Review, Immutability & Exports
    # =========================================================================
    # Create an initial in-review Handover Report
    sections = {
        "project_overview": {
            "key": "project_overview",
            "title": "Project Overview",
            "content": "E2E Distributed Gateway handover plan.",
            "claims": [{"statement": "Database configured.", "item_ids": [str(k_decision.id)]}],
            "evidence_references": [],
        },
        "completed_work": {
            "key": "completed_work",
            "title": "Completed Work",
            "content": "Done",
            "claims": [],
            "evidence_references": [],
        },
        "pending_tasks": {
            "key": "pending_tasks",
            "title": "Pending Tasks",
            "content": "JWT filter",
            "claims": [],
            "evidence_references": [],
        },
        "key_decisions": {
            "key": "key_decisions",
            "title": "Key Decisions",
            "content": "PostgreSQL 17",
            "claims": [],
            "evidence_references": [],
        },
        "risks_and_mitigations": {
            "key": "risks_and_mitigations",
            "title": "Risks",
            "content": "Memory",
            "claims": [],
            "evidence_references": [],
        },
        "dependencies_critical_paths": {
            "key": "dependencies_critical_paths",
            "title": "Dependencies",
            "content": "None",
            "claims": [],
            "evidence_references": [],
        },
        "knowledge_gaps_questions": {
            "key": "knowledge_gaps_questions",
            "title": "Gaps",
            "content": "None",
            "claims": [],
            "evidence_references": [],
        },
        "unresolved_conflicts": {
            "key": "unresolved_conflicts",
            "title": "Conflicts",
            "content": "None",
            "claims": [],
            "evidence_references": [],
        },
        "actionable_continuation_plan": {
            "key": "actionable_continuation_plan",
            "title": "Next Steps",
            "content": "Deploy",
            "claims": [],
            "evidence_references": [],
        },
        "departing_context_who_to_ask": {
            "key": "departing_context_who_to_ask",
            "title": "Context",
            "content": "Ask E2E lead",
            "claims": [],
            "evidence_references": [],
        },
    }

    report = HandoverReport(
        project_id=uuid.UUID(project_id),
        title="E2E Distributed Gateway - Handover Report",
        version=1,
        status=HandoverReportStatus.IN_REVIEW,
        departing_member_name="E2E Lead",
        focus_area="Routing & Security",
        approved_only=False,
        content_sections=sections,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.commit()

    # Fetch latest handover report
    h_latest = await client.get(
        f"/api/v1/projects/{project_id}/handover",
        headers=headers,
    )
    assert h_latest.status_code == 200
    report_data = h_latest.json()["report"]
    assert report_data is not None
    assert report_data["status"] == "in_review"
    report_id = report_data["id"]

    # Review and Approve report
    h_review = await client.post(
        f"/api/v1/projects/{project_id}/handover/{report_id}/review",
        headers=headers,
        json={
            "action": "approve",
            "comment": "Final E2E handover sign-off verified.",
        },
    )
    assert h_review.status_code == 200
    assert h_review.json()["status"] == "approved"

    # Verify Immutability: attempting to review an approved report raises 409 Conflict
    h_review_again = await client.post(
        f"/api/v1/projects/{project_id}/handover/{report_id}/review",
        headers=headers,
        json={
            "action": "reject",
            "comment": "Try to edit approved report.",
        },
    )
    assert h_review_again.status_code == 409
    assert h_review_again.json()["error"]["code"] == "CONFLICT"

    # Multi-format Exports
    md_export = await client.get(
        f"/api/v1/projects/{project_id}/handover/{report_id}/export/markdown",
        headers=headers,
    )
    assert md_export.status_code == 200
    assert "text/markdown" in md_export.headers["content-type"]
    assert "# " in md_export.text

    pdf_export = await client.get(
        f"/api/v1/projects/{project_id}/handover/{report_id}/export/pdf",
        headers=headers,
    )
    assert pdf_export.status_code == 200
    assert "application/pdf" in pdf_export.headers["content-type"]
    assert pdf_export.content.startswith(b"%PDF")

    docx_export = await client.get(
        f"/api/v1/projects/{project_id}/handover/{report_id}/export/docx",
        headers=headers,
    )
    assert docx_export.status_code == 200
    assert (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        in docx_export.headers["content-type"]
    )

    # =========================================================================
    # Step 10: Activity Feed Audit Trail
    # =========================================================================
    activity_res = await client.get(
        f"/api/v1/projects/{project_id}/activity",
        headers=headers,
    )
    assert activity_res.status_code == 200
    activities = activity_res.json()["items"]
    assert len(activities) >= 1
    # Check that audited actions exist
    assert any(
        act["entity_type"] in ("handover_report", "knowledge_item", "source") for act in activities
    )
