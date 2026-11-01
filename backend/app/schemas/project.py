import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ProjectRole
from app.schemas.user import UserRead


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProjectMemberBase(BaseModel):
    role: ProjectRole = ProjectRole.MEMBER


class ProjectMemberAdd(BaseModel):
    email: EmailStr
    role: ProjectRole = ProjectRole.MEMBER


class ProjectMemberUpdate(BaseModel):
    role: ProjectRole


class ProjectMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: ProjectRole
    created_at: datetime
    updated_at: datetime
    user: UserRead | None = None


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    my_role: ProjectRole | None = None


class ProjectDetailRead(ProjectRead):
    members: list[ProjectMemberRead] = []
