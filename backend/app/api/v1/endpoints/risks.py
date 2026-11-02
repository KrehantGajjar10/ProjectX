import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.risk import RiskSummaryRead
from app.services.risk_service import get_risk_service

router = APIRouter()


@router.get(
    "/{project_id}/risks",
    response_model=RiskSummaryRead,
    summary="List extracted and computed project risks with deterministic signals",
)
async def list_project_risks(
    project_id: uuid.UUID,
    severity: str | None = Query(
        None, description="Filter by severity: critical, high, medium, low"
    ),
    category: str | None = Query(None, description="Filter by risk category"),
    source_type: str | None = Query(
        None, description="Filter by source type: extracted, computed_signal"
    ),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> RiskSummaryRead:
    """Combines extracted risks with computed signals (overdue tasks, missing owners,

    conflicts, unverified evidence, stale tasks, SPOK) and returns severity-rated findings.
    """
    risk_service = get_risk_service()
    return await risk_service.get_project_risks(
        db=db,
        project_id=project_id,
        severity=severity,
        category=category,
        source_type=source_type,
    )
