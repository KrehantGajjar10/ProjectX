import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IngestionJobStatus


class IngestionJobCreate(BaseModel):
    source_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Optional list of specific source IDs to ingest. If omitted, all project sources are ingested.",
    )


class IngestionJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    source_id: uuid.UUID | None
    status: IngestionJobStatus
    progress: int
    error: str | None
    retry_count: int
    max_retries: int
    metadata_info: dict[str, Any]
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
