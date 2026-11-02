import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TaskStatus


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: str = "medium"
    due_date: datetime | None = None


class TaskCreate(TaskBase):
    knowledge_item_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus | None = None
    owner_id: uuid.UUID | None = None
    priority: str | None = None
    due_date: datetime | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    knowledge_item_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class TaskProgressSummary(BaseModel):
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    blocked_tasks: int
    cancelled_tasks: int
    completion_percentage: float
    overdue_tasks: int
    unassigned_tasks: int
