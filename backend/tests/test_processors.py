import io

import docx
from pptx import Presentation
from pypdf import PdfWriter

from app.processors.code import CodeProcessor
from app.processors.docx import DocxProcessor
from app.processors.markdown import MarkdownProcessor
from app.processors.pdf import PdfProcessor
from app.processors.pptx import PptxProcessor
from app.processors.registry import get_processor_registry
from app.processors.text import PlainTextProcessor


def test_markdown_processor():
    processor = MarkdownProcessor()
    md_content = """# System Architecture

We are building ProjectX.

## Component A
Component A is the API layer.

### Subcomponent A.1
Details of A.1.

## Component B
Component B handles background workers.
"""
    doc = processor.process(md_content, file_path="docs/architecture.md")

    assert doc.file_type == "markdown"
    assert doc.title == "architecture.md"
    assert len(doc.sections) == 4
    assert doc.sections[0].location_info["heading"] == "System Architecture"
    assert doc.sections[1].location_info["heading"] == "Component A"
    assert doc.sections[2].location_info["heading"] == "Subcomponent A.1"
    assert doc.sections[3].location_info["heading"] == "Component B"
    assert doc.sections[0].location_info["line_start"] == 1


def test_pdf_processor():
    processor = PdfProcessor()

    # Create a 2-page in-memory PDF
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_blank_page(width=200, height=200)
    stream = io.BytesIO()
    writer.write(stream)
    pdf_bytes = stream.getvalue()

    doc = processor.process(pdf_bytes, file_path="reports/q3_report.pdf")
    assert doc.file_type == "pdf"
    assert doc.metadata["total_pages"] == 2
    assert doc.content_hash is not None


def test_docx_processor():
    processor = DocxProcessor()

    doc_obj = docx.Document()
    doc_obj.add_heading("Executive Summary", level=1)
    doc_obj.add_paragraph("This is the project handover overview.")
    doc_obj.add_heading("Tech Decisions", level=2)
    doc_obj.add_paragraph("FastAPI and PostgreSQL were selected.")

    stream = io.BytesIO()
    doc_obj.save(stream)
    docx_bytes = stream.getvalue()

    doc = processor.process(docx_bytes, file_path="spec.docx")
    assert doc.file_type == "docx"
    assert len(doc.sections) == 2
    assert doc.sections[0].location_info["heading"] == "Executive Summary"
    assert "project handover overview" in doc.sections[0].content
    assert doc.sections[1].location_info["heading"] == "Tech Decisions"


def test_pptx_processor():
    processor = PptxProcessor()

    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = "ProjectX Kickoff"
    slide.placeholders[1].text = "Transform scattered data into handovers"

    stream = io.BytesIO()
    prs.save(stream)
    pptx_bytes = stream.getvalue()

    doc = processor.process(pptx_bytes, file_path="deck.pptx")
    assert doc.file_type == "pptx"
    assert doc.metadata["total_slides"] == 1
    assert len(doc.sections) == 1
    assert doc.sections[0].location_info["page"] == 1
    assert "ProjectX Kickoff" in doc.sections[0].content


def test_plain_text_processor():
    processor = PlainTextProcessor(block_lines=5)
    content = "\n".join(f"Line {i}" for i in range(1, 13))

    doc = processor.process(content, file_path="notes.txt")
    assert doc.file_type == "text"
    assert len(doc.sections) == 3
    assert doc.sections[0].location_info["line_start"] == 1
    assert doc.sections[0].location_info["line_end"] == 5
    assert doc.sections[2].location_info["line_start"] == 11
    assert doc.sections[2].location_info["line_end"] == 12


def test_code_processor_python():
    processor = CodeProcessor()
    py_code = '''"""Module docstring."""
import os

class DatabaseConnector:
    """Connects to the database."""
    def __init__(self, url: str):
        self.url = url

async def fetch_user(user_id: int):
    return {"id": user_id}
'''
    doc = processor.process(py_code, file_path="app/db.py")
    assert doc.file_type == "code"
    assert doc.metadata["language"] == "python"

    symbols = [s.location_info.get("symbol_name") for s in doc.sections]
    assert "DatabaseConnector" in symbols
    assert "fetch_user" in symbols


def test_code_processor_typescript():
    processor = CodeProcessor()
    ts_code = """import { useState } from "react";

export interface UserProps {
    id: string;
    name: string;
}

export function UserCard({ id, name }: UserProps) {
    return <div>{name}</div>;
}
"""
    doc = processor.process(ts_code, file_path="components/UserCard.tsx")
    assert doc.file_type == "code"
    assert doc.metadata["language"] == "typescript-react"

    symbols = [s.location_info.get("symbol_name") for s in doc.sections]
    assert "UserProps" in symbols
    assert "UserCard" in symbols


def test_processor_registry():
    registry = get_processor_registry()
    assert isinstance(registry.get_processor("readme.md"), MarkdownProcessor)
    assert isinstance(registry.get_processor("report.pdf"), PdfProcessor)
    assert isinstance(registry.get_processor("spec.docx"), DocxProcessor)
    assert isinstance(registry.get_processor("slides.pptx"), PptxProcessor)
    assert isinstance(registry.get_processor("server.py"), CodeProcessor)
    assert isinstance(registry.get_processor("client.ts"), CodeProcessor)
    assert isinstance(registry.get_processor("log.txt"), PlainTextProcessor)
