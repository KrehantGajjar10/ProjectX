from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceRead


class TimelineEventRead(BaseModel):
    id: str
    event_type: str  # "milestone", "decision", "task", "commit"
    title: str
    description: str | None = None
    timestamp: datetime
    actor: str | None = None
    status: str | None = None
    metadata_info: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceRead] = Field(default_factory=list)


class TimelineResponse(BaseModel):
    events: list[TimelineEventRead] = Field(default_factory=list)
    total_events: int
