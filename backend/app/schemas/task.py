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


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    knowledge_item_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
