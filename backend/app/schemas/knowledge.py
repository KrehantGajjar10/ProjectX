import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import KnowledgeCategory, KnowledgeOrigin, KnowledgeReviewStatus
from app.schemas.evidence import EvidenceRead
from app.schemas.task import TaskRead


class KnowledgeItemBase(BaseModel):
    category: KnowledgeCategory
    title: str = Field(..., min_length=1, max_length=500)
    description: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    origin: KnowledgeOrigin = KnowledgeOrigin.EXPLICIT_FACT


class KnowledgeItemCreate(KnowledgeItemBase):
    pass


class DependencyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    source_knowledge_item_id: uuid.UUID | None = None
    target_knowledge_item_id: uuid.UUID | None = None
    source_task_id: uuid.UUID | None = None
    target_task_id: uuid.UUID | None = None
    type: str
    evidence_text: str | None = None
    created_at: datetime
    updated_at: datetime


class KnowledgeItemRead(KnowledgeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    review_status: KnowledgeReviewStatus
    reviewer_id: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    created_at: datetime
    updated_at: datetime
    evidences: list[EvidenceRead] = []


class KnowledgeItemDetailRead(KnowledgeItemRead):
    tasks: list[TaskRead] = []
    source_dependencies: list[DependencyRead] = []
    target_dependencies: list[DependencyRead] = []


class KnowledgeItemReview(BaseModel):
    review_status: KnowledgeReviewStatus
    review_note: str | None = None


class KnowledgeItemReviewRequest(BaseModel):
    review_status: KnowledgeReviewStatus
    review_note: str | None = None
    title: str | None = None
    description: str | None = None


class BulkReviewRequest(BaseModel):
    item_ids: list[uuid.UUID] = Field(..., min_length=1)
    review_status: KnowledgeReviewStatus
    review_note: str | None = None


class BulkReviewResponse(BaseModel):
    updated_count: int
    review_status: KnowledgeReviewStatus


class GapItemRead(BaseModel):
    id: uuid.UUID
    category: KnowledgeCategory
    title: str
    gap_type: str
    details: str
    confidence: float
    review_status: KnowledgeReviewStatus


class ConflictItemRead(BaseModel):
    knowledge_item_id: uuid.UUID
    title: str
    conflict_note: str
