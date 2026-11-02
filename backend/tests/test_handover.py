import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    HandoverReportStatus,
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    ProjectRole,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.handover import HandoverReport
from app.models.knowledge import KnowledgeItem
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.handover import EvidenceReference, HandoverGenerateRequest
from app.services.handover_service import get_handover_service
from app.services.handover_validator import HandoverValidator


def test_claim_validation_drops_and_flags_unreferenced_statements():
    """Unit test for HandoverValidator verifying grounding checks and statement filtering."""
    validator = HandoverValidator()

    valid_item_id = uuid.uuid4()
    item_without_ev_id = uuid.uuid4()
    bogus_item_id = uuid.uuid4()

    ev_ref = EvidenceReference(
        evidence_id=uuid.uuid4(),
        knowledge_item_id=valid_item_id,
        knowledge_item_title="PostgreSQL 17 Architecture",
        source_locator="README.md:10",
        exact_excerpt="PostgreSQL 17 serves as the primary transactional datastore.",
        verified=True,
        review_status="approved",
        origin="explicit_fact",
        confidence=0.98,
    )

    grounding_items_map = {
        valid_item_id: {
            "id": valid_item_id,
            "title": "PostgreSQL 17 Architecture",
            "review_status": "approved",
            "origin": "explicit_fact",
            "evidences": [ev_ref],
        },
        item_without_ev_id: {
            "id": item_without_ev_id,
            "title": "Unverified Assumption",
            "review_status": "pending",
            "origin": "ai_inference",
            "evidences": [],  # No evidence!
        },
    }

    raw_sections = {
        "key_decisions": {
            "title": "Key Decisions with Rationale",
            "narrative": "Core architecture overview",
            "statements": [
                {
                    "text": "PostgreSQL 17 is used for transactional storage.",
                    "item_ids": [str(valid_item_id)],
                },
                {
                    "text": "Completely hallucinated claim with fake ID.",
                    "item_ids": [str(bogus_item_id)],
                },
                {
                    "text": "Claim citing item that lacks supporting evidence.",
                    "item_ids": [str(item_without_ev_id)],
                },
            ],
        }
    }

    # Case 1: Flag unverified (default)
    sections, all_evs, total, verified, unverified = validator.validate_sections(
        raw_sections=raw_sections,
        grounding_items_map=grounding_items_map,
        drop_unverified=False,
    )
    assert total == 3
    assert verified == 1
    assert unverified == 2
    claims = sections["key_decisions"].claims
    assert len(claims) == 3
    assert claims[0].verified is True
    assert claims[0].review_status == "approved"
    assert claims[0].origin == "explicit_fact"
    assert len(claims[0].evidence_references) == 1

    assert claims[1].verified is False
    assert claims[1].flagged_unverified is True
    assert claims[2].verified is False
    assert claims[2].flagged_unverified is True

    # Case 2: Drop unverified statements
    sec_drop, _, tot_d, ver_d, unver_d = validator.validate_sections(
        raw_sections=raw_sections,
        grounding_items_map=grounding_items_map,
        drop_unverified=True,
    )
    assert len(sec_drop["key_decisions"].claims) == 1
    assert (
        sec_drop["key_decisions"].claims[0].text
        == "PostgreSQL 17 is used for transactional storage."
    )


@pytest.mark.asyncio
async def test_handover_generation_job_and_versioning(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    user_a: User,
    db_session: AsyncSession,
):
    """Tests background handover generation, version incrementing, listing, and diffing."""
    # Seed knowledge item and task with evidence
    kitem = KnowledgeItem(
        project_id=project_a.id,
        title="Async Event Bus Decision",
        description="Kafka used for async events",
        category=KnowledgeCategory.DECISION,
        confidence=0.95,
        review_status=KnowledgeReviewStatus.APPROVED,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
    )
    db_session.add(kitem)
    await db_session.flush()

    ev = Evidence(
        project_id=project_a.id,
        knowledge_item_id=kitem.id,
        source_locator="ARCH.md:12",
        exact_excerpt="Kafka manages distributed asynchronous events",
        verified=True,
        confidence=0.96,
    )
    task = Task(
        project_id=project_a.id,
        title="Provision Kafka Cluster",
        status=TaskStatus.COMPLETED,
        priority="high",
        knowledge_item_id=kitem.id,
    )
    db_session.add_all([ev, task])
    await db_session.commit()

    # 1. Start generation (creates Version 1)
    handover_service = get_handover_service()
    gen_req = HandoverGenerateRequest(
        departing_member_name="Alice Architect",
        focus_area="Infrastructure",
        approved_only=False,
    )
    rep1 = await handover_service.generate_handover_report(
        db=db_session,
        project_id=project_a.id,
        user_id=user_a.id,
        request_in=gen_req,
    )
    assert rep1.version == 1
    assert rep1.status == HandoverReportStatus.DRAFT
    assert rep1.departing_member_name == "Alice Architect"
    assert rep1.verified_claims >= 1

    # 2. Generate again (creates Version 2)
    rep2 = await handover_service.generate_handover_report(
        db=db_session,
        project_id=project_a.id,
        user_id=user_a.id,
        request_in=gen_req,
    )
    assert rep2.version == 2
    assert rep2.status == HandoverReportStatus.DRAFT

    # 3. GET /handover returns latest report (v2)
    resp_latest = await client.get(
        f"/api/v1/projects/{project_a.id}/handover",
        headers=auth_headers_a,
    )
    assert resp_latest.status_code == 200
    latest_data = resp_latest.json()
    assert latest_data["report"] is not None
    assert latest_data["report"]["version"] == 2

    # 4. GET /handover/versions returns list with v2 and v1
    resp_versions = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/versions",
        headers=auth_headers_a,
    )
    assert resp_versions.status_code == 200
    versions_list = resp_versions.json()
    assert len(versions_list) >= 2
    assert versions_list[0]["version"] == 2
    assert versions_list[1]["version"] == 1

    # 5. GET /handover/versions/1 retrieves v1
    resp_v1 = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/versions/1",
        headers=auth_headers_a,
    )
    assert resp_v1.status_code == 200
    assert resp_v1.json()["version"] == 1

    # 6. GET /handover/diff compares v1 and v2
    resp_diff = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/diff?v1=1&v2=2",
        headers=auth_headers_a,
    )
    assert resp_diff.status_code == 200
    diff_data = resp_diff.json()
    assert diff_data["v1_version"] == 1
    assert diff_data["v2_version"] == 2
    assert len(diff_data["section_diffs"]) >= 5


@pytest.mark.asyncio
async def test_handover_workflow_and_immutability(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    user_a: User,
    db_session: AsyncSession,
):
    """Tests draft -> in_review -> reject -> draft -> approve, and confirms approved reports become immutable."""
    # Seed a draft report
    report = HandoverReport(
        project_id=project_a.id,
        title="Apollo Handover",
        version=1,
        status=HandoverReportStatus.DRAFT,
        content_sections={
            "key_decisions": {
                "title": "Key Decisions",
                "narrative": "Initial architectural plan",
                "claims": [],
                "evidence_references": [],
            }
        },
        created_by_id=user_a.id,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    # 1. Submit for review (draft -> in_review)
    resp_submit = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/submit",
        headers=auth_headers_a,
    )
    assert resp_submit.status_code == 200
    assert resp_submit.json()["status"] == "in_review"

    # 2. Reject with feedback (in_review -> draft)
    reject_payload = {"action": "reject", "comment": "Please add more details on deployment"}
    resp_reject = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/review",
        json=reject_payload,
        headers=auth_headers_a,
    )
    assert resp_reject.status_code == 200
    assert resp_reject.json()["status"] == "draft"
    assert resp_reject.json()["review_comment"] == "Please add more details on deployment"

    # 3. Submit again (draft -> in_review)
    resp_submit2 = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/submit",
        headers=auth_headers_a,
    )
    assert resp_submit2.status_code == 200
    assert resp_submit2.json()["status"] == "in_review"

    # 4. Approve (in_review -> approved)
    approve_payload = {"action": "approve", "comment": "Approved without objections"}
    resp_approve = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/review",
        json=approve_payload,
        headers=auth_headers_a,
    )
    assert resp_approve.status_code == 200
    approved_data = resp_approve.json()
    assert approved_data["status"] == "approved"
    assert approved_data["approved_by_id"] == str(user_a.id)
    assert approved_data["approved_at"] is not None

    # 5. IMMUTABILITY CHECK: Approved report rejects further submissions
    resp_submit_immutable = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/submit",
        headers=auth_headers_a,
    )
    assert resp_submit_immutable.status_code in (400, 409)

    # 6. IMMUTABILITY CHECK: Approved report rejects further reviews
    resp_review_immutable = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/review",
        json=approve_payload,
        headers=auth_headers_a,
    )
    assert resp_review_immutable.status_code in (400, 409)


@pytest.mark.asyncio
async def test_role_based_access_control_audit(
    client: AsyncClient,
    auth_headers_b: dict[str, str],
    project_a: Project,
    user_b: User,
    db_session: AsyncSession,
):
    """Verifies that role enforcement is strictly applied (viewer vs member vs reviewer)."""
    # Make User B a VIEWER
    member_b = ProjectMember(
        project_id=project_a.id,
        user_id=user_b.id,
        role=ProjectRole.VIEWER,
    )
    db_session.add(member_b)

    report = HandoverReport(
        project_id=project_a.id,
        title="Test Report",
        version=1,
        status=HandoverReportStatus.DRAFT,
        content_sections={},
    )
    db_session.add(report)
    await db_session.commit()

    # Viewer CANNOT start generation (requires member+)
    resp_gen = await client.post(
        f"/api/v1/projects/{project_a.id}/handover",
        json={},
        headers=auth_headers_b,
    )
    assert resp_gen.status_code == 403

    # Viewer CANNOT submit report (requires member+)
    resp_sub = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/submit",
        headers=auth_headers_b,
    )
    assert resp_sub.status_code == 403

    # Viewer CANNOT review report (requires reviewer+)
    resp_rev = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/review",
        json={"action": "approve"},
        headers=auth_headers_b,
    )
    assert resp_rev.status_code == 403

    # Viewer CAN read reports
    resp_read = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/versions",
        headers=auth_headers_b,
    )
    assert resp_read.status_code == 200

    # Promote User B to MEMBER
    member_b.role = ProjectRole.MEMBER
    await db_session.commit()

    # Member CAN submit report
    resp_sub_member = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/submit",
        headers=auth_headers_b,
    )
    assert resp_sub_member.status_code == 200

    # Member CANNOT review report (requires reviewer+)
    resp_rev_member = await client.post(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/review",
        json={"action": "approve"},
        headers=auth_headers_b,
    )
    assert resp_rev_member.status_code == 403


@pytest.mark.asyncio
async def test_handover_export_content_and_evidence_appendix(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    user_a: User,
    db_session: AsyncSession,
):
    """Verifies Markdown, PDF, and DOCX exports with footnotes and evidence appendices."""
    # Seed knowledge item and evidence
    kitem = KnowledgeItem(
        project_id=project_a.id,
        title="Zero Trust Network Security",
        description="Enforce mTLS on all internal gRPC endpoints",
        category=KnowledgeCategory.DECISION,
        confidence=0.99,
        review_status=KnowledgeReviewStatus.APPROVED,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
    )
    db_session.add(kitem)
    await db_session.flush()

    ev = Evidence(
        project_id=project_a.id,
        knowledge_item_id=kitem.id,
        source_locator="SECURITY.md:42",
        exact_excerpt="Mutual TLS is strictly mandated for all intra-cluster service communications.",
        verified=True,
        confidence=0.99,
    )
    db_session.add(ev)
    await db_session.commit()

    # Generate report
    handover_service = get_handover_service()
    gen_req = HandoverGenerateRequest(departing_member_name="Lead SecOps")
    report = await handover_service.generate_handover_report(
        db=db_session,
        project_id=project_a.id,
        user_id=user_a.id,
        request_in=gen_req,
    )

    # 1. Export Markdown
    resp_md = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/export/markdown",
        headers=auth_headers_a,
    )
    assert resp_md.status_code == 200
    assert "text/markdown" in resp_md.headers["content-type"]
    md_text = resp_md.text
    assert f"# {report.title}" in md_text
    assert "## Evidence & Grounding Appendix" in md_text
    assert "SECURITY.md:42" in md_text
    assert "Mutual TLS is strictly mandated" in md_text

    # 2. Export PDF
    resp_pdf = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/export/pdf",
        headers=auth_headers_a,
    )
    assert resp_pdf.status_code == 200
    assert "application/pdf" in resp_pdf.headers["content-type"]
    assert resp_pdf.content.startswith(b"%PDF")

    # 3. Export DOCX
    resp_docx = await client.get(
        f"/api/v1/projects/{project_a.id}/handover/{report.id}/export/docx",
        headers=auth_headers_a,
    )
    assert resp_docx.status_code == 200
    assert "officedocument.wordprocessingml" in resp_docx.headers["content-type"]
    assert resp_docx.content.startswith(b"PK\x03\x04")


@pytest.mark.asyncio
async def test_project_activity_audit_endpoint(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    user_a: User,
    db_session: AsyncSession,
):
    """Verifies that project audit events are persisted and queried via /projects/{id}/activity."""
    # Seed knowledge item and review it
    kitem = KnowledgeItem(
        project_id=project_a.id,
        title="Microservice API Gateway",
        description="Envoy proxy gateway",
        category=KnowledgeCategory.DECISION,
        confidence=0.92,
        review_status=KnowledgeReviewStatus.PENDING,
    )
    db_session.add(kitem)
    await db_session.commit()
    await db_session.refresh(kitem)

    # Review knowledge item
    resp_review = await client.post(
        f"/api/v1/projects/{project_a.id}/knowledge/{kitem.id}/review",
        json={"review_status": "approved", "review_note": "LGTM"},
        headers=auth_headers_a,
    )
    assert resp_review.status_code == 200

    # Query activity feed
    resp_act = await client.get(
        f"/api/v1/projects/{project_a.id}/activity",
        headers=auth_headers_a,
    )
    assert resp_act.status_code == 200
    act_data = resp_act.json()
    assert act_data["total"] >= 1
    actions = [it["action"] for it in act_data["items"]]
    assert "knowledge_review" in actions
    review_entry = next(it for it in act_data["items"] if it["action"] == "knowledge_review")
    assert review_entry["actor_name"] == user_a.full_name
    assert review_entry["entity_id"] == str(kitem.id)
