import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GitHubSourceCreate(BaseModel):
    repo_url: str = Field(..., description="GitHub repository URL or 'owner/repo'")
    branch: str | None = Field(default=None, description="Optional branch or commit SHA")
    access_token: str | None = Field(
        default=None,
        description="Optional custom GitHub Personal Access Token (defaults to GITHUB_ACCESS_TOKEN env)",
    )
    name: str | None = Field(default=None, description="Optional custom source name")


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    type: str
    config: dict[str, Any]
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class UploadFileDetail(BaseModel):
    filename: str
    storage_path: str
    mime_type: str
    size: int


class UploadSourceResponse(BaseModel):
    source: SourceRead
    files: list[UploadFileDetail]
