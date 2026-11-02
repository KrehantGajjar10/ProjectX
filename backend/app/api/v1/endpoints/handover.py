import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.schemas.handover import (
    HandoverDiffResponse,
    HandoverGenerateRequest,
    HandoverReportDetailRead,
    HandoverReportVersionSummary,
    HandoverReviewRequest,
    LatestHandoverResponse,
)
from app.schemas.ingestion import IngestionJobRead
from app.services.audit_service import get_audit_service
from app.services.handover_exporter import get_handover_exporter
from app.services.handover_service import get_handover_service

router = APIRouter()


@router.post(
    "/{project_id}/handover",
    response_model=IngestionJobRead,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start handover generation as a background job (requires member role or higher)",
)
async def start_handover_generation(
    project_id: uuid.UUID,
    request_in: HandoverGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> IngestionJobRead:
    """Enqueues and starts a background handover report generation job."""
    handover_service = get_handover_service()
    job = await handover_service.start_handover_generation(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
        request_in=request_in,
        background_tasks=background_tasks,
    )
    return IngestionJobRead.model_validate(job)


@router.get(
    "/{project_id}/handover",
    response_model=LatestHandoverResponse,
    summary="Get the latest handover report and its status (requires viewer role or higher)",
)
async def get_latest_handover(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> LatestHandoverResponse:
    """Returns the latest project handover report and active generation job status."""
    handover_service = get_handover_service()
    return await handover_service.get_latest_handover(db=db, project_id=project_id)


@router.get(
    "/{project_id}/handover/versions",
    response_model=list[HandoverReportVersionSummary],
    summary="List all handover report versions for a project (requires viewer role or higher)",
)
async def list_handover_versions(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[HandoverReportVersionSummary]:
    """Lists summary of all generated handover versions in reverse chronological order."""
    handover_service = get_handover_service()
    return await handover_service.list_versions(db=db, project_id=project_id)


@router.get(
    "/{project_id}/handover/versions/{version_or_id}",
    response_model=HandoverReportDetailRead,
    summary="Get a specific handover report version by version number or UUID (requires viewer role or higher)",
)
async def get_handover_version(
    project_id: uuid.UUID,
    version_or_id: str,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> HandoverReportDetailRead:
    """Retrieves full detail of a specific handover version."""
    handover_service = get_handover_service()
    return await handover_service.get_version(
        db=db, project_id=project_id, version_or_id=version_or_id
    )


@router.get(
    "/{project_id}/handover/diff",
    response_model=HandoverDiffResponse,
    summary="Compare two handover versions at a section level (requires viewer role or higher)",
)
async def diff_handover_versions(
    project_id: uuid.UUID,
    v1: int = Query(..., ge=1, description="Base version number"),
    v2: int = Query(..., ge=1, description="Target version number to compare with"),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> HandoverDiffResponse:
    """Returns section-by-section diff showing changed narratives, claim counts, and evidence counts."""
    handover_service = get_handover_service()
    return await handover_service.diff_reports(db=db, project_id=project_id, v1=v1, v2=v2)


@router.post(
    "/{project_id}/handover/{report_id}/submit",
    response_model=HandoverReportDetailRead,
    summary="Submit a draft report for review (requires member role or higher)",
)
async def submit_handover_for_review(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> HandoverReportDetailRead:
    """Transitions report from draft to in_review. Rejects if report is already approved."""
    handover_service = get_handover_service()
    return await handover_service.submit_for_review(
        db=db,
        project_id=project_id,
        report_id=report_id,
        user_id=current_user.id,
    )


@router.post(
    "/{project_id}/handover/{report_id}/review",
    response_model=HandoverReportDetailRead,
    summary="Approve or reject a report with audited feedback (requires reviewer role or higher)",
)
async def review_handover_report(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    review_in: HandoverReviewRequest,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.REVIEWER)
    ),
    db: AsyncSession = Depends(get_db),
) -> HandoverReportDetailRead:
    """Reviews a report. If approved, the report becomes permanently immutable."""
    handover_service = get_handover_service()
    return await handover_service.review_report(
        db=db,
        project_id=project_id,
        report_id=report_id,
        user_id=current_user.id,
        action=review_in.action,
        comment=review_in.comment,
    )


@router.get(
    "/{project_id}/handover/{report_id}/export/markdown",
    summary="Download handover report as GitHub-Flavored Markdown (requires viewer role or higher)",
)
async def export_handover_markdown(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports report to Markdown with footnote citations and Evidence Appendix."""
    handover_service = get_handover_service()
    report = await handover_service.get_version(
        db=db, project_id=project_id, version_or_id=str(report_id)
    )

    exporter = get_handover_exporter()
    md_content = exporter.export_markdown(report)

    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_user.id,
        action="handover_export",
        entity_type="handover_report",
        entity_id=report.id,
        details={"format": "markdown", "version": report.version},
    )

    filename = f"handover_v{report.version}_{project_id}.md"
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{project_id}/handover/{report_id}/export/pdf",
    summary="Download handover report as formatted PDF (requires viewer role or higher)",
)
async def export_handover_pdf(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports report to formatted PDF bytes with Evidence Appendix."""
    handover_service = get_handover_service()
    report = await handover_service.get_version(
        db=db, project_id=project_id, version_or_id=str(report_id)
    )

    exporter = get_handover_exporter()
    pdf_bytes = exporter.export_pdf(report)

    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_user.id,
        action="handover_export",
        entity_type="handover_report",
        entity_id=report.id,
        details={"format": "pdf", "version": report.version},
    )

    filename = f"handover_v{report.version}_{project_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{project_id}/handover/{report_id}/export/docx",
    summary="Download handover report as Microsoft Word (.docx) (requires viewer role or higher)",
)
async def export_handover_docx(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports report to formatted Word document (.docx) bytes with Evidence Appendix table."""
    handover_service = get_handover_service()
    report = await handover_service.get_version(
        db=db, project_id=project_id, version_or_id=str(report_id)
    )

    exporter = get_handover_exporter()
    docx_bytes = exporter.export_docx(report)

    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_user.id,
        action="handover_export",
        entity_type="handover_report",
        entity_id=report.id,
        details={"format": "docx", "version": report.version},
    )

    filename = f"handover_v{report.version}_{project_id}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
