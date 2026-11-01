import io
from typing import Any

from pypdf import PdfReader

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class PdfProcessor(BaseFileProcessor):
    """Page-aware PDF processor that extracts text per page."""

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
        reader = PdfReader(stream)

        sections: list[ProcessedSection] = []
        raw_pages: list[str] = []

        total_pages = len(reader.pages)
        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            page_text = page.extract_text() or ""
            raw_pages.append(page_text)

            if page_text.strip():
                sections.append(
                    ProcessedSection(
                        content=page_text.strip(),
                        location_info={
                            "file_path": file_path,
                            "file_type": "pdf",
                            "page": page_num,
                            "total_pages": total_pages,
                        },
                    )
                )

        full_raw_text = "\n\n--- Page Break ---\n\n".join(raw_pages)

        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update({"total_pages": total_pages})

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="pdf",
            mime_type=mime_type or "application/pdf",
            metadata=doc_meta,
            sections=sections,
            raw_content=full_raw_text,
        )
