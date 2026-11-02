import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import HandoverReportStatus


class HandoverGenerateRequest(BaseModel):
    departing_member_name: str | None = Field(
        None,
        description="Optional name of the departing team member to highlight sole-knowledge areas",
    )
    focus_area: str | None = Field(
        None,
        description="Optional focus area or component to prioritize in the continuation plan",
    )
    approved_only: bool = Field(
        False,
        description="Whether to include only approved knowledge (default: approved first, labelling pending ones)",
    )


class EvidenceReference(BaseModel):
    evidence_id: uuid.UUID
    knowledge_item_id: uuid.UUID
    knowledge_item_title: str
    document_name: str | None = None
    source_locator: str
    exact_excerpt: str
    verified: bool = True
    review_status: str = "approved"  # "approved", "pending", "rejected"
    origin: str = "explicit_fact"  # "explicit_fact", "ai_inference"
    confidence: float = 1.0


class HandoverClaim(BaseModel):
    text: str
    referenced_item_ids: list[uuid.UUID] = Field(default_factory=list)
    verified: bool = True
    evidence_references: list[EvidenceReference] = Field(default_factory=list)
    review_status: str = "approved"  # "approved", "pending", "ai_inference"
    origin: str = "explicit_fact"  # "explicit_fact", "ai_inference"
    flagged_unverified: bool = False


class HandoverSection(BaseModel):
    key: str
    title: str
    narrative: str
    claims: list[HandoverClaim] = Field(default_factory=list)
    evidence_references: list[EvidenceReference] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)


class HandoverReportBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    version: int = 1
    status: HandoverReportStatus = HandoverReportStatus.DRAFT
    content_sections: dict[str, Any] = Field(default_factory=dict)


class HandoverReportCreate(HandoverReportBase):
    departing_member_name: str | None = None
    focus_area: str | None = None
    approved_only: bool = False


class HandoverReportRead(HandoverReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    departing_member_name: str | None = None
    focus_area: str | None = None
    approved_only: bool = False
    review_comment: str | None = None
    generated_at: datetime
    created_by_id: uuid.UUID | None = None
    approved_by_id: uuid.UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class HandoverReportDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    version: int
    status: HandoverReportStatus
    departing_member_name: str | None = None
    focus_area: str | None = None
    approved_only: bool = False
    review_comment: str | None = None
    sections: dict[str, HandoverSection] = Field(default_factory=dict)
    all_evidence_references: list[EvidenceReference] = Field(default_factory=list)
    total_claims: int = 0
    verified_claims: int = 0
    unverified_claims: int = 0
    generated_at: datetime
    created_by_id: uuid.UUID | None = None
    approved_by_id: uuid.UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class HandoverReportVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    version: int
    status: HandoverReportStatus
    departing_member_name: str | None = None
    focus_area: str | None = None
    total_claims: int = 0
    evidence_count: int = 0
    generated_at: datetime
    approved_at: datetime | None = None
    approved_by_id: uuid.UUID | None = None


class HandoverReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$", description="'approve' or 'reject'")
    comment: str | None = Field(None, description="Audited review comment or feedback")


class HandoverDiffSection(BaseModel):
    section_key: str
    section_title: str
    v1_claims_count: int
    v2_claims_count: int
    v1_evidence_count: int
    v2_evidence_count: int
    content_changed: bool
    v1_summary: str
    v2_summary: str


class HandoverDiffResponse(BaseModel):
    project_id: uuid.UUID
    v1_version: int
    v2_version: int
    v1_status: str
    v2_status: str
    section_diffs: list[HandoverDiffSection]


class HandoverGenerationJobStatus(BaseModel):
    job_id: uuid.UUID
    status: str
    progress: int
    error: str | None = None
    report_id: uuid.UUID | None = None
    created_at: datetime


class LatestHandoverResponse(BaseModel):
    report: HandoverReportDetailRead | None = None
    active_job: HandoverGenerationJobStatus | None = None
