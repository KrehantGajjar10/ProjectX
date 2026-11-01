import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.ingestion import IngestionJobCreate, IngestionJobRead
from app.services import source_service

router = APIRouter()


@router.post(
    "/{project_id}/ingestion/jobs",
    response_model=IngestionJobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Enqueue a new background ingestion job for project sources (requires member role or higher)",
)
async def start_ingestion_job(
    project_id: uuid.UUID,
    job_in: IngestionJobCreate,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> IngestionJobRead:
    job = await source_service.create_ingestion_job(
        db=db,
        project_id=project_id,
        source_ids=job_in.source_ids,
    )
    return IngestionJobRead.model_validate(job)


@router.get(
    "/{project_id}/ingestion/jobs",
    response_model=list[IngestionJobRead],
    summary="List all ingestion jobs for this project (requires viewer role or higher)",
)
async def list_ingestion_jobs(
    project_id: uuid.UUID,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[IngestionJobRead]:
    jobs = await source_service.list_project_jobs(db, project_id)
    return [IngestionJobRead.model_validate(j) for j in jobs]


@router.get(
    "/{project_id}/ingestion/jobs/{job_id}",
    response_model=IngestionJobRead,
    summary="Get status, progress, and error details of an ingestion job (requires viewer role or higher)",
)
async def get_ingestion_job_status(
    project_id: uuid.UUID,
    job_id: uuid.UUID,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> IngestionJobRead:
    job = await source_service.get_job_by_id(db, project_id, job_id)
    if not job:
        raise NotFoundError(message="Ingestion job not found in project.")
    return IngestionJobRead.model_validate(job)
