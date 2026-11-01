import hashlib
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class ProcessedSection(BaseModel):
    """Normalized atomic section extracted from a document by a processor."""

    content: str
    location_info: dict[str, Any] = Field(
        default_factory=dict,
        description="Location trace: file_path, file_type, page, line_start, line_end, heading, symbol_name",
    )
    token_count: int | None = None


class ProcessedDocument(BaseModel):
    """Normalized document representation returned by all processors."""

    title: str
    content_hash: str
    file_path: str
    file_type: str
    mime_type: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    sections: list[ProcessedSection] = Field(default_factory=list)
    raw_content: str | None = None


class BaseFileProcessor(ABC):
    """Abstract base class for all file and content processors."""

    @staticmethod
    def compute_sha256(content: str | bytes) -> str:
        if isinstance(content, str):
            content = content.encode("utf-8", errors="replace")
        return hashlib.sha256(content).hexdigest()

    @abstractmethod
    def process(
        self,
        content: str | bytes,
        file_path: str,
        title: str | None = None,
        mime_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProcessedDocument:
        """Processes content into a normalized ProcessedDocument with sections."""
        ...
