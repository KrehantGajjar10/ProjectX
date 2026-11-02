import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.knowledge import KnowledgeItemRead
from app.schemas.risk import RiskItemRead
from app.schemas.task import TaskProgressSummary, TaskRead
from app.schemas.timeline import TimelineEventRead


class DashboardHighlights(BaseModel):
    critical_risks: list[RiskItemRead] = Field(default_factory=list)
    blocked_tasks: list[TaskRead] = Field(default_factory=list)
    recent_decisions: list[KnowledgeItemRead] = Field(default_factory=list)


class ProjectDashboardSummary(BaseModel):
    project_id: uuid.UUID
    name: str
    description: str | None = None
    items_by_category: dict[str, int] = Field(default_factory=dict)
    items_by_review_status: dict[str, int] = Field(default_factory=dict)
    unreviewed_items_count: int = 0
    open_risks_by_severity: dict[str, int] = Field(default_factory=dict)
    total_risks_count: int = 0
    gaps_count: int = 0
    conflicts_count: int = 0
    tasks_progress: TaskProgressSummary
    last_ingestion_status: dict[str, Any] | None = None
    recent_activity: list[TimelineEventRead] = Field(default_factory=list)
    highlights: DashboardHighlights
