import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.timeline import TimelineResponse
from app.services.timeline_service import get_timeline_service

router = APIRouter()


@router.get(
    "/{project_id}/timeline",
    response_model=TimelineResponse,
    summary="Get chronological timeline combining milestones, key decisions, commits, and tasks",
)
async def get_project_timeline(
    project_id: uuid.UUID,
    start_date: datetime | None = Query(None, description="Filter events after this timestamp"),
    end_date: datetime | None = Query(None, description="Filter events before this timestamp"),
    event_type: list[str] | None = Query(
        None, description="Filter by event types: milestone, decision, task, commit"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> TimelineResponse:
    """Returns chronologically ordered events with linked evidence and commit provenance."""
    timeline_service = get_timeline_service()
    return await timeline_service.get_project_timeline(
        db=db,
        project_id=project_id,
        start_date=start_date,
        end_date=end_date,
        event_types=event_type,
        skip=skip,
        limit=limit,
    )
