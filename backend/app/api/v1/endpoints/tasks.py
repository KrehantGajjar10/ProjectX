import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, require_project_role
from app.db.session import get_db
from app.models.enums import ProjectRole, TaskStatus
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.schemas.task import TaskProgressSummary, TaskRead, TaskUpdate
from app.services.task_service import get_task_service

router = APIRouter()


@router.get(
    "/{project_id}/tasks",
    response_model=list[TaskRead],
    summary="List and filter tasks by status, owner, due date, and priority",
)
async def list_project_tasks(
    project_id: uuid.UUID,
    status: TaskStatus | None = Query(None, description="Exact task status filter"),
    is_completed: bool | None = Query(None, description="Filter completed vs incomplete tasks"),
    is_blocked: bool | None = Query(None, description="Filter blocked tasks"),
    owner_id: uuid.UUID | None = Query(None, description="Filter by task owner"),
    due_before: datetime | None = Query(None, description="Filter tasks due before this date"),
    due_after: datetime | None = Query(None, description="Filter tasks due after this date"),
    priority: str | None = Query(
        None, description="Filter by priority: low, medium, high, critical"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[TaskRead]:
    """Lists project tasks with rich filtering."""
    task_service = get_task_service()
    tasks = await task_service.list_tasks(
        db=db,
        project_id=project_id,
        status=status,
        is_completed=is_completed,
        is_blocked=is_blocked,
        owner_id=owner_id,
        due_before=due_before,
        due_after=due_after,
        priority=priority,
        skip=skip,
        limit=limit,
    )
    return [TaskRead.model_validate(t) for t in tasks]


@router.get(
    "/{project_id}/tasks/progress",
    response_model=TaskProgressSummary,
    summary="Get project task progress summary with counts and completion percentages",
)
async def get_project_tasks_progress(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> TaskProgressSummary:
    """Computes completion rates, overdue counts, and blocked item counts."""
    task_service = get_task_service()
    return await task_service.get_task_progress(db=db, project_id=project_id)


@router.patch(
    "/{project_id}/tasks/{task_id}",
    response_model=TaskRead,
    status_code=status.HTTP_200_OK,
    summary="Update task status, owner, priority, or due date with audit tracking",
)
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    """Updates task fields with user attribution and timestamp auditing."""
    task_service = get_task_service()
    updated_task = await task_service.update_task(
        db=db,
        project_id=project_id,
        task_id=task_id,
        user_id=current_user.id,
        task_in=task_in,
    )
    return TaskRead.model_validate(updated_task)
