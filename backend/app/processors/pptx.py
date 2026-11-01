import io
from typing import Any

from pptx import Presentation

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class PptxProcessor(BaseFileProcessor):
    """Slide-aware PPTX processor extracting text and structure per slide."""

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
        prs = Presentation(stream)

        sections: list[ProcessedSection] = []
        raw_slides: list[str] = []

        total_slides = len(prs.slides)
        for idx, slide in enumerate(prs.slides):
            slide_num = idx + 1
            slide_texts: list[str] = []

            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        text = paragraph.text.strip()
                        if text:
                            slide_texts.append(text)

            slide_body = "\n".join(slide_texts).strip()
            raw_slides.append(f"--- Slide {slide_num} ---\n" + slide_body)

            if slide_body:
                sections.append(
                    ProcessedSection(
                        content=slide_body,
                        location_info={
                            "file_path": file_path,
                            "file_type": "pptx",
                            "page": slide_num,
                            "slide": slide_num,
                            "total_slides": total_slides,
                        },
                    )
                )

        full_raw_text = "\n\n".join(raw_slides)
        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update({"total_slides": total_slides})

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="pptx",
            mime_type=mime_type
            or "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            metadata=doc_meta,
            sections=sections,
            raw_content=full_raw_text,
        )
