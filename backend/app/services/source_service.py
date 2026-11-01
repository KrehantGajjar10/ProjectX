import uuid
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.integrations.connectors.github_connector import GitHubConnector
from app.integrations.github import GitHubClient
from app.models.enums import IngestionJobStatus
from app.models.ingestion import IngestionJob
from app.models.source import Source
from app.schemas.source import GitHubSourceCreate, UploadFileDetail
from app.services.storage import StorageBackend, get_storage


async def create_github_source(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    source_in: GitHubSourceCreate,
) -> Source:
    try:
        owner, repo = GitHubClient.parse_repo_url(source_in.repo_url)
    except ValueError as exc:
        raise BadRequestError(message=str(exc)) from exc

    # Validate accessibility
    connector = GitHubConnector(
        repo_url=source_in.repo_url,
        branch=source_in.branch,
        access_token=source_in.access_token,
    )
    try:
        await connector.validate_connection()
    except Exception as exc:
        raise BadRequestError(message=f"Failed to connect to GitHub repository: {exc}") from exc

    source_name = source_in.name or f"{owner}/{repo}"

    config: dict[str, Any] = {
        "repo_url": source_in.repo_url,
        "owner": owner,
        "repo": repo,
        "branch": source_in.branch,
    }
    if source_in.access_token:
        config["access_token"] = source_in.access_token

    source = Source(
        project_id=project_id,
        name=source_name,
        type="github",
        config=config,
        created_by_id=user_id,
    )
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def create_or_update_upload_source(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    files: list[UploadFile],
    storage: StorageBackend | None = None,
) -> tuple[Source, list[UploadFileDetail]]:
    if not files:
        raise BadRequestError(message="No files provided for upload.")

    storage_backend = storage or get_storage()
    uploaded_details: list[UploadFileDetail] = []
    file_records: list[dict[str, Any]] = []

    # 1. Validate all files
    for file in files:
        filename = file.filename or "uploaded_file"
        ext = Path(filename).suffix.lower()

        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            allowed_str = ", ".join(settings.ALLOWED_UPLOAD_EXTENSIONS)
            raise BadRequestError(
                message=f"File '{filename}' has invalid extension '{ext}'. Allowed: {allowed_str}"
            )

        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise BadRequestError(
                message=f"File '{filename}' exceeds maximum allowed size of {max_mb} MB."
            )

        # Generate unique storage path
        unique_id = uuid.uuid4().hex[:8]
        safe_name = f"{unique_id}_{filename}"
        storage_rel_path = f"projects/{project_id}/uploads/{safe_name}"

        # Save to storage
        await storage_backend.save_file(storage_rel_path, content)

        detail = UploadFileDetail(
            filename=filename,
            storage_path=storage_rel_path,
            mime_type=file.content_type or "application/octet-stream",
            size=len(content),
        )
        uploaded_details.append(detail)
        file_records.append(detail.model_dump())

    # 2. Find or create Upload Source for project
    query = select(Source).where(
        Source.project_id == project_id,
        Source.type == "upload",
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if source:
        # Append files to existing source
        existing_files = source.config.get("files", [])
        existing_files.extend(file_records)
        source.config = {"files": existing_files}
    else:
        source = Source(
            project_id=project_id,
            name="Uploaded Documents",
            type="upload",
            config={"files": file_records},
            created_by_id=user_id,
        )
        db.add(source)

    await db.flush()
    await db.refresh(source)
    return source, uploaded_details


async def list_project_sources(db: AsyncSession, project_id: uuid.UUID) -> list[Source]:
    query = select(Source).where(Source.project_id == project_id).order_by(Source.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_source_by_id(
    db: AsyncSession, project_id: uuid.UUID, source_id: uuid.UUID
) -> Source | None:
    query = select(Source).where(Source.project_id == project_id, Source.id == source_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def delete_source(db: AsyncSession, source: Source) -> None:
    # Delete uploaded files from storage if it's an upload source
    if source.type == "upload":
        storage = get_storage()
        files = source.config.get("files", [])
        for f in files:
            path = f.get("storage_path")
            if path:
                try:
                    await storage.delete_file(path)
                except Exception:
                    pass

    await db.delete(source)
    await db.flush()


async def create_ingestion_job(
    db: AsyncSession,
    project_id: uuid.UUID,
    source_ids: list[uuid.UUID] | None = None,
) -> IngestionJob:
    # Validate source IDs if given
    if source_ids:
        query = select(Source.id).where(
            Source.project_id == project_id,
            Source.id.in_(source_ids),
        )
        result = await db.execute(query)
        found_ids = set(result.scalars().all())
        missing = [sid for sid in source_ids if sid not in found_ids]
        if missing:
            raise NotFoundError(
                message=f"Sources not found in project: {[str(m) for m in missing]}"
            )

    job = IngestionJob(
        project_id=project_id,
        status=IngestionJobStatus.QUEUED,
        progress=0,
        metadata_info={"source_ids": [str(sid) for sid in source_ids] if source_ids else []},
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def list_project_jobs(db: AsyncSession, project_id: uuid.UUID) -> list[IngestionJob]:
    query = (
        select(IngestionJob)
        .where(IngestionJob.project_id == project_id)
        .order_by(IngestionJob.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_job_by_id(
    db: AsyncSession, project_id: uuid.UUID, job_id: uuid.UUID
) -> IngestionJob | None:
    query = select(IngestionJob).where(
        IngestionJob.project_id == project_id, IngestionJob.id == job_id
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()
