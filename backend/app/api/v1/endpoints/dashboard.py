import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.dashboard import ProjectDashboardSummary
from app.services.dashboard_service import get_dashboard_service

router = APIRouter()


@router.get(
    "/{project_id}/dashboard",
    response_model=ProjectDashboardSummary,
    summary="Get single-call project dashboard summary with stats, risks, timeline, and highlights",
)
async def get_project_dashboard(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> ProjectDashboardSummary:
    """Returns a unified project overview:

    - Knowledge item category & review counts
    - Total risks broken down by severity (critical, high, medium, low)
    - Tasks progress (total, completed, pending, blocked, overdue, completion rate)
    - Knowledge gaps and conflicts count
    - Last ingestion status and error details
    - Recent chronological activity feed
    - Critical highlights (critical risks, blocked tasks, recent decisions)
    """
    dashboard_service = get_dashboard_service()
    return await dashboard_service.get_project_dashboard(db=db, project_id=project_id)
