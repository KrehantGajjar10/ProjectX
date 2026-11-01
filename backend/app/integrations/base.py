from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class FetchedItem(BaseModel):
    """Normalized representation of any item fetched from an external source or upload."""

    id: str = Field(..., description="Unique item identifier within the source, e.g. path or URL")
    title: str = Field(..., description="Human-readable title or filename")
    path: str = Field(..., description="Relative or absolute path for location tracing")
    content: str | bytes = Field(..., description="Raw text or binary content")
    mime_type: str = Field(default="text/plain", description="MIME type of the item")
    item_type: str = Field(
        default="file",
        description="Type of item: file, commit, issue, pull_request, document, etc.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Arbitrary source metadata")


class BaseConnector(ABC):
    """Base interface for all source connectors (GitHub, Uploads, Slack, Jira, Drive)."""

    @abstractmethod
    async def validate_connection(self) -> bool:
        """Validates credentials and accessibility of the source."""
        ...

    @abstractmethod
    async def fetch_all(self) -> list[FetchedItem]:
        """Fetches all relevant items from the source."""
        ...
