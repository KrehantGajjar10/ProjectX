from typing import Any

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class PlainTextProcessor(BaseFileProcessor):
    """Line-aware plain text processor."""

    def __init__(self, block_lines: int = 50) -> None:
        self.block_lines = block_lines

    def process(
        self,
        content: str | bytes,
        file_path: str,
        title: str | None = None,
        mime_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProcessedDocument:
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = content

        content_hash = self.compute_sha256(text)
        doc_title = title or file_path.split("/")[-1]

        lines = text.splitlines(keepends=True)
        sections: list[ProcessedSection] = []

        total_lines = len(lines)
        if total_lines == 0:
            return ProcessedDocument(
                title=doc_title,
                content_hash=content_hash,
                file_path=file_path,
                file_type="text",
                mime_type=mime_type or "text/plain",
                metadata=metadata or {},
                sections=[],
                raw_content="",
            )

        for start_idx in range(0, total_lines, self.block_lines):
            end_idx = min(start_idx + self.block_lines, total_lines)
            block_content = "".join(lines[start_idx:end_idx]).strip()
            if block_content:
                sections.append(
                    ProcessedSection(
                        content=block_content,
                        location_info={
                            "file_path": file_path,
                            "file_type": "text",
                            "line_start": start_idx + 1,
                            "line_end": end_idx,
                            "total_lines": total_lines,
                        },
                    )
                )

        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update({"total_lines": total_lines})

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="text",
            mime_type=mime_type or "text/plain",
            metadata=doc_meta,
            sections=sections,
            raw_content=text,
        )
