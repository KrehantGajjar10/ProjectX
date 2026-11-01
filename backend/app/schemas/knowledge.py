import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import KnowledgeCategory, KnowledgeOrigin, KnowledgeReviewStatus


class KnowledgeItemBase(BaseModel):
    category: KnowledgeCategory
    title: str = Field(..., min_length=1, max_length=500)
    description: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    origin: KnowledgeOrigin = KnowledgeOrigin.EXPLICIT_FACT


class KnowledgeItemCreate(KnowledgeItemBase):
    pass


class KnowledgeItemReview(BaseModel):
    review_status: KnowledgeReviewStatus
    review_note: str | None = None


class KnowledgeItemRead(KnowledgeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    review_status: KnowledgeReviewStatus
    reviewer_id: uuid.UUID | None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime
    updated_at: datetime
