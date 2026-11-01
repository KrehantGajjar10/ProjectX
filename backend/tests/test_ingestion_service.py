import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.models.source import Source
from app.services.ingestion_service import IngestionService
from app.services.storage import LocalStorageBackend


@pytest.mark.asyncio
async def test_idempotent_ingestion(db_session: AsyncSession, project_a, tmp_path):
    storage = LocalStorageBackend(base_dir=tmp_path)
    ingestion_service = IngestionService(storage=storage)

    # 1. Prepare 2 sample files in storage
    rel_path_1 = "projects/test/doc1.md"
    content_1 = b"# Document 1\nInitial content for doc 1."
    await storage.save_file(rel_path_1, content_1)

    rel_path_2 = "projects/test/code.py"
    content_2 = b"def calculate_total():\n    return 42\n"
    await storage.save_file(rel_path_2, content_2)

    source = Source(
        project_id=project_a.id,
        name="Test Upload Source",
        type="upload",
        config={
            "files": [
                {
                    "filename": "doc1.md",
                    "storage_path": rel_path_1,
                    "mime_type": "text/markdown",
                },
                {
                    "filename": "code.py",
                    "storage_path": rel_path_2,
                    "mime_type": "text/plain",
                },
            ]
        },
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    # First Ingestion
    stats_1 = await ingestion_service.ingest_source(
        db=db_session,
        project_id=project_a.id,
        source=source,
    )
    await db_session.commit()

    assert stats_1["created"] == 2
    assert stats_1["updated"] == 0
    assert stats_1["unchanged"] == 0
    assert stats_1["chunks_created"] > 0

    docs_q = select(Document).where(Document.source_id == source.id)
    res_docs = await db_session.execute(docs_q)
    docs = list(res_docs.scalars().all())
    assert len(docs) == 2

    chunks_q = select(DocumentChunk).where(DocumentChunk.document_id.in_([d.id for d in docs]))
    res_chunks = await db_session.execute(chunks_q)
    initial_chunks = list(res_chunks.scalars().all())
    initial_chunk_count = len(initial_chunks)
    assert initial_chunk_count > 0

    # Second Ingestion (UNCHANGED CONTENT -> IDEMPOTENT)
    stats_2 = await ingestion_service.ingest_source(
        db=db_session,
        project_id=project_a.id,
        source=source,
    )
    await db_session.commit()

    assert stats_2["created"] == 0
    assert stats_2["updated"] == 0
    assert stats_2["unchanged"] == 2
    assert stats_2["chunks_created"] == 0

    # Total documents and chunks remain identical
    res_docs_2 = await db_session.execute(docs_q)
    assert len(list(res_docs_2.scalars().all())) == 2
    res_chunks_2 = await db_session.execute(chunks_q)
    assert len(list(res_chunks_2.scalars().all())) == initial_chunk_count

    # 3. Third Ingestion with 1 CHANGED file
    new_content_1 = b"# Document 1 Updated\nNew paragraph with updated insights."
    await storage.save_file(rel_path_1, new_content_1)

    stats_3 = await ingestion_service.ingest_source(
        db=db_session,
        project_id=project_a.id,
        source=source,
    )
    await db_session.commit()

    assert stats_3["created"] == 0
    assert stats_3["updated"] == 1
    assert stats_3["unchanged"] == 1

    # Verify updated document title and content hash
    doc1_q = select(Document).where(
        Document.source_id == source.id, Document.file_path == "doc1.md"
    )
    doc1 = (await db_session.execute(doc1_q)).scalar_one()
    assert "New paragraph with updated insights" in doc1.raw_content

    # 4. Fourth Ingestion with 1 REMOVED file
    source.config = {
        "files": [
            {
                "filename": "code.py",
                "storage_path": rel_path_2,
                "mime_type": "text/plain",
            }
        ]
    }
    stats_4 = await ingestion_service.ingest_source(
        db=db_session,
        project_id=project_a.id,
        source=source,
    )
    await db_session.commit()

    assert stats_4["removed"] == 1

    doc1_check = (await db_session.execute(doc1_q)).scalar_one()
    assert doc1_check.status == "removed"
