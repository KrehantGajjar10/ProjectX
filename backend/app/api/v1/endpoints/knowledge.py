import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, require_project_role
from app.db.session import get_db
from app.models.enums import (
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    ProjectRole,
    TaskStatus,
)
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.schemas.knowledge import (
    BulkReviewRequest,
    BulkReviewResponse,
    ConflictItemRead,
    GapItemRead,
    KnowledgeItemDetailRead,
    KnowledgeItemRead,
    KnowledgeItemReviewRequest,
)
from app.schemas.task import TaskRead
from app.services.knowledge_service import knowledge_service

router = APIRouter()


@router.get(
    "/{project_id}/knowledge",
    response_model=list[KnowledgeItemRead],
    summary="List knowledge items for a project with filters and pagination",
)
async def list_knowledge(
    project_id: uuid.UUID,
    category: KnowledgeCategory | None = Query(None, description="Filter by category"),
    review_status: KnowledgeReviewStatus | None = Query(
        None, description="Filter by review status"
    ),
    origin: KnowledgeOrigin | None = Query(
        None, description="Filter by origin (explicit_fact vs ai_inference)"
    ),
    min_confidence: float | None = Query(
        None, ge=0.0, le=1.0, description="Minimum confidence threshold"
    ),
    max_confidence: float | None = Query(
        None, ge=0.0, le=1.0, description="Maximum confidence threshold"
    ),
    verified: bool | None = Query(None, description="Filter items having verified evidence"),
    q: str | None = Query(None, description="Search text in title or description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeItemRead]:
    items = await knowledge_service.list_knowledge_items(
        db=db,
        project_id=project_id,
        category=category,
        review_status=review_status,
        origin=origin,
        min_confidence=min_confidence,
        max_confidence=max_confidence,
        verified=verified,
        q=q,
        skip=skip,
        limit=limit,
    )
    return [KnowledgeItemRead.model_validate(item) for item in items]


@router.get(
    "/{project_id}/knowledge/{item_id}",
    response_model=KnowledgeItemDetailRead,
    summary="Get single knowledge item with all evidence and related items",
)
async def get_knowledge_item_detail(
    project_id: uuid.UUID,
    item_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeItemDetailRead:
    item = await knowledge_service.get_knowledge_item(db=db, project_id=project_id, item_id=item_id)
    return KnowledgeItemDetailRead.model_validate(item)


@router.post(
    "/{project_id}/knowledge/{item_id}/review",
    response_model=KnowledgeItemDetailRead,
    status_code=status.HTTP_200_OK,
    summary="Review (approve, reject, edit) a knowledge item with audit tracking",
)
async def review_knowledge_item(
    project_id: uuid.UUID,
    item_id: uuid.UUID,
    review_data: KnowledgeItemReviewRequest,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.REVIEWER)
    ),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeItemDetailRead:
    item = await knowledge_service.review_knowledge_item(
        db=db,
        project_id=project_id,
        item_id=item_id,
        reviewer_id=current_user.id,
        review_data=review_data,
    )
    return KnowledgeItemDetailRead.model_validate(item)


@router.post(
    "/{project_id}/knowledge/bulk-review",
    response_model=BulkReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk review knowledge items",
)
async def bulk_review_knowledge_items(
    project_id: uuid.UUID,
    bulk_data: BulkReviewRequest,
    current_user: User = Depends(get_current_active_user),
    _membership: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.REVIEWER)
    ),
    db: AsyncSession = Depends(get_db),
) -> BulkReviewResponse:
    count = await knowledge_service.bulk_review_knowledge_items(
        db=db,
        project_id=project_id,
        reviewer_id=current_user.id,
        bulk_data=bulk_data,
    )
    return BulkReviewResponse(
        updated_count=count,
        review_status=bulk_data.review_status,
    )


@router.get(
    "/{project_id}/tasks",
    response_model=list[TaskRead],
    summary="List project tasks with status and owner filters",
)
async def list_project_tasks(
    project_id: uuid.UUID,
    status: TaskStatus | None = Query(None, description="Filter by task status"),
    owner_id: uuid.UUID | None = Query(None, description="Filter by task owner ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[TaskRead]:
    tasks = await knowledge_service.list_project_tasks(
        db=db,
        project_id=project_id,
        status=status,
        owner_id=owner_id,
        skip=skip,
        limit=limit,
    )
    return [TaskRead.model_validate(t) for t in tasks]


@router.get(
    "/{project_id}/gaps",
    response_model=list[GapItemRead],
    summary="List flagged knowledge gaps (missing owners/dates, missing rationale, unverified)",
)
async def list_project_gaps(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[GapItemRead]:
    return await knowledge_service.list_project_gaps(db=db, project_id=project_id)


@router.get(
    "/{project_id}/conflicts",
    response_model=list[ConflictItemRead],
    summary="List detected conflicting decisions and stances",
)
async def list_project_conflicts(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[ConflictItemRead]:
    return await knowledge_service.list_project_conflicts(db=db, project_id=project_id)
