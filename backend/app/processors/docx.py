import io
from typing import Any

import docx

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class DocxProcessor(BaseFileProcessor):
    """DOCX processor that extracts text and sections based on Word paragraph styles."""

    def process(
        self,
        content: str | bytes,
        file_path: str,
        title: str | None = None,
        mime_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProcessedDocument:
        if isinstance(content, str):
            content_bytes = content.encode("utf-8", errors="replace")
        else:
            content_bytes = content

        content_hash = self.compute_sha256(content_bytes)
        doc_title = title or file_path.split("/")[-1]

        stream = io.BytesIO(content_bytes)
        doc = docx.Document(stream)

        sections: list[ProcessedSection] = []
        raw_paragraphs: list[str] = []

        current_heading = "Introduction"
        current_level = 1
        current_paras: list[str] = []
        para_start_idx = 1

        for idx, p in enumerate(doc.paragraphs):
            para_num = idx + 1
            text = p.text.strip()
            if not text:
                continue

            raw_paragraphs.append(text)
            style_name = p.style.name.lower() if p.style else ""

            if "heading" in style_name:
                # Extract level if present (e.g. 'heading 1' -> 1)
                level = 1
                for char in style_name:
                    if char.isdigit():
                        level = int(char)
                        break

                if current_paras:
                    section_content = "\n\n".join(current_paras).strip()
                    if section_content:
                        sections.append(
                            ProcessedSection(
                                content=section_content,
                                location_info={
                                    "file_path": file_path,
                                    "file_type": "docx",
                                    "heading": current_heading,
                                    "heading_level": current_level,
                                    "para_start": para_start_idx,
                                    "para_end": para_num - 1,
                                },
                            )
                        )

                current_heading = text
                current_level = level
                current_paras = [text]
                para_start_idx = para_num
            else:
                current_paras.append(text)

        # Flush final section
        if current_paras:
            section_content = "\n\n".join(current_paras).strip()
            if section_content:
                sections.append(
                    ProcessedSection(
                        content=section_content,
                        location_info={
                            "file_path": file_path,
                            "file_type": "docx",
                            "heading": current_heading,
                            "heading_level": current_level,
                            "para_start": para_start_idx,
                            "para_end": len(doc.paragraphs),
                        },
                    )
                )

        full_raw_text = "\n\n".join(raw_paragraphs)
        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update({"total_paragraphs": len(doc.paragraphs)})

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="docx",
            mime_type=mime_type
            or "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            metadata=doc_meta,
            sections=sections,
            raw_content=full_raw_text,
        )
