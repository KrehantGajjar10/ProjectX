import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: uuid.UUID | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ProjectActivityResponse(BaseModel):
    items: list[AuditLogRead]
    total: int
    skip: int
    limit: int
