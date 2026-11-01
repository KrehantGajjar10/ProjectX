import re
from typing import Any

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class MarkdownProcessor(BaseFileProcessor):
    """Heading-aware Markdown processor that extracts sections with hierarchy and line ranges."""

    HEADING_REGEX = re.compile(r"^(#{1,6})\s+(.*)$")

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

        current_heading = "Introduction"
        current_level = 1
        current_lines: list[str] = []
        section_start_line = 1

        for idx, line in enumerate(lines):
            line_num = idx + 1
            heading_match = self.HEADING_REGEX.match(line.strip())

            if heading_match:
                # If we have accumulated lines for the previous section, flush them
                if current_lines:
                    section_content = "".join(current_lines).strip()
                    if section_content:
                        sections.append(
                            ProcessedSection(
                                content=section_content,
                                location_info={
                                    "file_path": file_path,
                                    "file_type": "markdown",
                                    "heading": current_heading,
                                    "heading_level": current_level,
                                    "line_start": section_start_line,
                                    "line_end": line_num - 1,
                                },
                            )
                        )
                # Start new section
                current_level = len(heading_match.group(1))
                current_heading = heading_match.group(2).strip()
                current_lines = [line]
                section_start_line = line_num
            else:
                current_lines.append(line)

        # Flush final section
        if current_lines:
            section_content = "".join(current_lines).strip()
            if section_content:
                sections.append(
                    ProcessedSection(
                        content=section_content,
                        location_info={
                            "file_path": file_path,
                            "file_type": "markdown",
                            "heading": current_heading,
                            "heading_level": current_level,
                            "line_start": section_start_line,
                            "line_end": len(lines),
                        },
                    )
                )

        # If document had no headings at all, create a single section with whole content
        if not sections and text.strip():
            sections.append(
                ProcessedSection(
                    content=text.strip(),
                    location_info={
                        "file_path": file_path,
                        "file_type": "markdown",
                        "heading": "Document Content",
                        "line_start": 1,
                        "line_end": len(lines),
                    },
                )
            )

        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update({"total_lines": len(lines), "total_sections": len(sections)})

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="markdown",
            mime_type=mime_type or "text/markdown",
            metadata=doc_meta,
            sections=sections,
            raw_content=text,
        )
