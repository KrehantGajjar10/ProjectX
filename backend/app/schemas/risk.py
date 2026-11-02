import uuid

from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceRead


class RiskItemRead(BaseModel):
    id: str
    title: str
    description: str
    category: str  # "extracted_risk", "schedule", "ownership", "conflict", "unverified_evidence", "stale_task", "single_point_of_knowledge"
    severity: str  # "critical", "high", "medium", "low"
    rationale: str
    source_type: str  # "extracted" vs "computed_signal"
    confidence: float = 1.0
    entity_id: uuid.UUID | None = None
    evidence: list[EvidenceRead] = Field(default_factory=list)


class RiskSummaryRead(BaseModel):
    total_risks: int
    by_severity: dict[str, int] = Field(default_factory=dict)
    by_category: dict[str, int] = Field(default_factory=dict)
    by_source_type: dict[str, int] = Field(default_factory=dict)
    risks: list[RiskItemRead] = Field(default_factory=list)
