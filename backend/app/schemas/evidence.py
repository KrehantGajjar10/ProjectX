import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EvidenceBase(BaseModel):
    source_locator: str = Field(..., max_length=1024)
    exact_excerpt: str
    verified: bool = False
    confidence: float | None = None


class EvidenceCreate(EvidenceBase):
    knowledge_item_id: uuid.UUID
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None


class EvidenceRead(EvidenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    knowledge_item_id: uuid.UUID
    document_id: uuid.UUID | None
    chunk_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
