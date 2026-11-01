import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import HandoverReportStatus


class HandoverReportBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    version: int = 1
    status: HandoverReportStatus = HandoverReportStatus.DRAFT
    content_sections: dict[str, Any] = Field(default_factory=dict)


class HandoverReportCreate(HandoverReportBase):
    pass


class HandoverReportRead(HandoverReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    generated_at: datetime
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
