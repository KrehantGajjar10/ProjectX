from pathlib import Path

from app.processors.base import BaseFileProcessor
from app.processors.code import CodeProcessor
from app.processors.docx import DocxProcessor
from app.processors.markdown import MarkdownProcessor
from app.processors.pdf import PdfProcessor
from app.processors.pptx import PptxProcessor
from app.processors.text import PlainTextProcessor


class ProcessorRegistry:
    """Registry routing file paths to their appropriate specialized processor."""

    def __init__(self) -> None:
        self.pdf_processor = PdfProcessor()
        self.markdown_processor = MarkdownProcessor()
        self.docx_processor = DocxProcessor()
        self.pptx_processor = PptxProcessor()
        self.code_processor = CodeProcessor()
        self.text_processor = PlainTextProcessor()

    def get_processor(self, file_path: str, mime_type: str | None = None) -> BaseFileProcessor:
        ext = Path(file_path).suffix.lower()

        if ext == ".pdf" or (mime_type and "pdf" in mime_type):
            return self.pdf_processor
        elif ext in (".md", ".markdown") or (mime_type and "markdown" in mime_type):
            return self.markdown_processor
        elif ext == ".docx" or (mime_type and "wordprocessingml" in mime_type):
            return self.docx_processor
        elif ext == ".pptx" or (mime_type and "presentationml" in mime_type):
            return self.pptx_processor
        elif ext in CodeProcessor.EXTENSION_MAP:
            return self.code_processor
        else:
            return self.text_processor


_global_registry: ProcessorRegistry | None = None


def get_processor_registry() -> ProcessorRegistry:
    global _global_registry
    if _global_registry is None:
        _global_registry = ProcessorRegistry()
    return _global_registry
