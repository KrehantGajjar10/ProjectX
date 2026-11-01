import uuid

from app.processors.base import ProcessedDocument, ProcessedSection
from app.services.chunking_service import ChunkingService


def test_chunking_prose_small_section():
    chunker = ChunkingService(chunk_size_tokens=100, chunk_overlap_tokens=20)
    doc_id = uuid.uuid4()
    src_id = uuid.uuid4()

    proc_doc = ProcessedDocument(
        title="Notes",
        content_hash="abc123hash",
        file_path="docs/notes.md",
        file_type="markdown",
        mime_type="text/markdown",
        sections=[
            ProcessedSection(
                content="Short markdown content that fits within token limits.",
                location_info={"heading": "Intro", "line_start": 1, "line_end": 3},
            )
        ],
    )

    chunks = chunker.chunk_processed_document(proc_doc, doc_id, src_id)
    assert len(chunks) == 1
    c = chunks[0]
    assert c.document_id == doc_id
    assert c.chunk_index == 0
    assert c.location_info["file_path"] == "docs/notes.md"
    assert c.location_info["heading"] == "Intro"
    assert c.location_info["source_id"] == str(src_id)


def test_chunking_prose_oversized_section_with_overlap():
    # Set a tiny chunk size to force multiple overlapping chunks
    chunker = ChunkingService(chunk_size_tokens=30, chunk_overlap_tokens=10)
    doc_id = uuid.uuid4()
    src_id = uuid.uuid4()

    long_text = "\n\n".join(
        f"Paragraph {i}: This is sentence number {i} detailing architectural considerations."
        for i in range(1, 15)
    )

    proc_doc = ProcessedDocument(
        title="LongDoc",
        content_hash="longhash",
        file_path="docs/long.md",
        file_type="markdown",
        mime_type="text/markdown",
        sections=[
            ProcessedSection(
                content=long_text,
                location_info={"heading": "Deep Dive", "line_start": 1, "line_end": 30},
            )
        ],
    )

    chunks = chunker.chunk_processed_document(proc_doc, doc_id, src_id)
    assert len(chunks) > 1
    # Verify sequential chunk indexing
    for idx, c in enumerate(chunks):
        assert c.chunk_index == idx
        assert c.location_info["heading"] == "Deep Dive"


def test_chunking_code_boundaries():
    chunker = ChunkingService(chunk_size_tokens=200, chunk_overlap_tokens=50)
    doc_id = uuid.uuid4()
    src_id = uuid.uuid4()

    proc_doc = ProcessedDocument(
        title="service.py",
        content_hash="codehash123",
        file_path="app/service.py",
        file_type="code",
        mime_type="text/plain",
        sections=[
            ProcessedSection(
                content="def compute_metrics(x: int) -> int:\n    return x * 2\n",
                location_info={
                    "symbol_name": "compute_metrics",
                    "symbol_type": "def",
                    "line_start": 1,
                    "line_end": 2,
                },
            ),
            ProcessedSection(
                content="class ServiceRunner:\n    def run(self):\n        pass\n",
                location_info={
                    "symbol_name": "ServiceRunner",
                    "symbol_type": "class",
                    "line_start": 4,
                    "line_end": 6,
                },
            ),
        ],
    )

    chunks = chunker.chunk_processed_document(proc_doc, doc_id, src_id)
    assert len(chunks) == 2
    assert chunks[0].location_info["symbol_name"] == "compute_metrics"
    assert chunks[1].location_info["symbol_name"] == "ServiceRunner"
