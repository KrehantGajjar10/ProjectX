import hashlib
from typing import Any

from pydantic import BaseModel


class ParsedChunk(BaseModel):
    index: int
    content: str
    token_count: int | None = None
    location_info: dict[str, Any]


class ParsedDocument(BaseModel):
    title: str
    content_hash: str
    raw_content: str
    mime_type: str
    metadata: dict[str, Any]
    chunks: list[ParsedChunk]


class FileProcessor:
    """Parses text, markdown, or code files into chunked structures with location metadata."""

    @staticmethod
    def compute_sha256(content: str | bytes) -> str:
        if isinstance(content, str):
            content = content.encode("utf-8")
        return hashlib.sha256(content).hexdigest()

    def parse_text(
        self,
        content: str,
        title: str,
        file_path: str = "",
        mime_type: str = "text/plain",
        chunk_size: int = 50,  # lines per chunk
    ) -> ParsedDocument:
        content_hash = self.compute_sha256(content)
        lines = content.splitlines(keepends=True)
        chunks: list[ParsedChunk] = []

        total_lines = len(lines)
        chunk_idx = 0
        for start_idx in range(0, max(total_lines, 1), chunk_size):
            end_idx = min(start_idx + chunk_size, total_lines)
            chunk_content = "".join(lines[start_idx:end_idx])
            chunks.append(
                ParsedChunk(
                    index=chunk_idx,
                    content=chunk_content,
                    token_count=len(chunk_content.split()),
                    location_info={
                        "file_path": file_path,
                        "line_start": start_idx + 1,
                        "line_end": end_idx,
                    },
                )
            )
            chunk_idx += 1

        return ParsedDocument(
            title=title,
            content_hash=content_hash,
            raw_content=content,
            mime_type=mime_type,
            metadata={"file_path": file_path, "total_lines": total_lines},
            chunks=chunks,
        )
