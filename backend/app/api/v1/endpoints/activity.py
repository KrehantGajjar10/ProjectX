import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.audit import ProjectActivityResponse
from app.services.audit_service import get_audit_service

router = APIRouter()


@router.get(
    "/{project_id}/activity",
    response_model=ProjectActivityResponse,
    summary="Get project audit log activity feed (requires viewer role or higher)",
)
async def list_project_activity(
    project_id: uuid.UUID,
    action: str | None = Query(None, description="Filter by action name"),
    entity_type: str | None = Query(None, description="Filter by entity type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> ProjectActivityResponse:
    """Returns chronological audit log entries for project activities (reviews, approvals, exports, role changes)."""
    audit_service = get_audit_service()
    return await audit_service.list_project_activity(
        db=db,
        project_id=project_id,
        action=action,
        entity_type=entity_type,
        skip=skip,
        limit=limit,
    )
