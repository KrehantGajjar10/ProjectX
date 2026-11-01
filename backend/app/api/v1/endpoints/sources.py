import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.source import (
    GitHubSourceCreate,
    SourceRead,
    UploadSourceResponse,
)
from app.services import source_service

router = APIRouter()


@router.post(
    "/{project_id}/sources/github",
    response_model=SourceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Connect a GitHub repository as a project knowledge source (requires admin role or higher)",
)
async def connect_github_source(
    project_id: uuid.UUID,
    source_in: GitHubSourceCreate,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
) -> SourceRead:
    _, member = project_and_member
    source = await source_service.create_github_source(
        db=db,
        project_id=project_id,
        user_id=member.user_id,
        source_in=source_in,
    )
    return SourceRead.model_validate(source)


@router.post(
    "/{project_id}/sources/upload",
    response_model=UploadSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload documents (PDF, Markdown, DOCX, PPTX, text) to project knowledge base (requires member role or higher)",
)
async def upload_documents(
    project_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.MEMBER)
    ),
    db: AsyncSession = Depends(get_db),
) -> UploadSourceResponse:
    _, member = project_and_member
    source, details = await source_service.create_or_update_upload_source(
        db=db,
        project_id=project_id,
        user_id=member.user_id,
        files=files,
    )
    return UploadSourceResponse(
        source=SourceRead.model_validate(source),
        files=details,
    )


@router.get(
    "/{project_id}/sources",
    response_model=list[SourceRead],
    summary="List all knowledge sources connected to this project (requires viewer role or higher)",
)
async def list_sources(
    project_id: uuid.UUID,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[SourceRead]:
    sources = await source_service.list_project_sources(db, project_id)
    return [SourceRead.model_validate(s) for s in sources]


@router.delete(
    "/{project_id}/sources/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a knowledge source and cascade remove its stored documents (requires admin role or higher)",
)
async def delete_source(
    project_id: uuid.UUID,
    source_id: uuid.UUID,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    source = await source_service.get_source_by_id(db, project_id, source_id)
    if not source:
        raise NotFoundError(message="Source not found in project.")
    await source_service.delete_source(db, source)
