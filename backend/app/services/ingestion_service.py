import logging
import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.connectors.github_connector import GitHubConnector
from app.integrations.connectors.upload_connector import UploadConnector
from app.models.document import Document, DocumentChunk
from app.models.source import Source
from app.processors.registry import get_processor_registry
from app.services.chunking_service import get_chunking_service
from app.services.storage import StorageBackend, get_storage

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates source fetching, processing, idempotent document updating, and chunking."""

    def __init__(self, storage: StorageBackend | None = None) -> None:
        self.processor_registry = get_processor_registry()
        self.chunker = get_chunking_service()
        self.storage = storage or get_storage()

    def _get_connector_for_source(self, source: Source):
        if source.type == "github":
            return GitHubConnector(
                repo_url=source.config.get("repo_url", ""),
                branch=source.config.get("branch"),
                access_token=source.config.get("access_token"),
            )
        elif source.type == "upload":
            return UploadConnector(
                files_config=source.config.get("files", []),
                storage=self.storage,
            )
        else:
            raise ValueError(f"Unsupported source type: {source.type}")

    async def ingest_source(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        source: Source,
        job_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Idempotently ingests content from a source into Documents and DocumentChunks."""
        connector = self._get_connector_for_source(source)
        items = await connector.fetch_all()

        stats = {
            "source_id": str(source.id),
            "source_name": source.name,
            "items_fetched": len(items),
            "created": 0,
            "updated": 0,
            "unchanged": 0,
            "removed": 0,
            "chunks_created": 0,
        }

        # Query all existing documents for this project & source
        query = select(Document).where(
            Document.project_id == project_id,
            Document.source_id == source.id,
        )
        result = await db.execute(query)
        existing_docs = {doc.file_path: doc for doc in result.scalars().all()}

        fetched_paths: set[str] = set()

        for item in items:
            item_path = item.path or item.id
            fetched_paths.add(item_path)

            processor = self.processor_registry.get_processor(item_path, mime_type=item.mime_type)
            processed_doc = processor.process(
                content=item.content,
                file_path=item_path,
                title=item.title,
                mime_type=item.mime_type,
                metadata=item.metadata,
            )

            # Check for zero extractable text warning
            doc_warning = processed_doc.metadata.get("warning")
            if doc_warning:
                logger.warning("Document '%s': %s", item_path, doc_warning)
                stats.setdefault("warnings", []).append(doc_warning)

            doc_status = "warning" if doc_warning else "parsed"

            existing_doc = existing_docs.get(item_path)

            if existing_doc:
                # Document already exists for this path
                if (
                    existing_doc.content_hash == processed_doc.content_hash
                    and existing_doc.status != "removed"
                ):
                    # Unchanged content: preserve existing document & chunks (Idempotent!)
                    stats["unchanged"] += 1
                    continue

                # Content changed or un-removed: update document and refresh chunks
                existing_doc.title = processed_doc.title
                existing_doc.content_hash = processed_doc.content_hash
                existing_doc.mime_type = processed_doc.mime_type
                existing_doc.raw_content = processed_doc.raw_content
                existing_doc.doc_metadata = processed_doc.metadata
                existing_doc.status = doc_status
                if job_id:
                    existing_doc.ingestion_job_id = job_id

                # Delete old chunks
                await db.execute(
                    delete(DocumentChunk).where(DocumentChunk.document_id == existing_doc.id)
                )

                # Generate fresh chunks
                new_chunks = self.chunker.chunk_processed_document(
                    processed_doc=processed_doc,
                    document_id=existing_doc.id,
                    source_id=source.id,
                )
                db.add_all(new_chunks)
                stats["updated"] += 1
                stats["chunks_created"] += len(new_chunks)

            else:
                # New document
                new_doc = Document(
                    project_id=project_id,
                    source_id=source.id,
                    ingestion_job_id=job_id,
                    title=processed_doc.title,
                    content_hash=processed_doc.content_hash,
                    file_path=item_path,
                    mime_type=processed_doc.mime_type,
                    raw_content=processed_doc.raw_content,
                    doc_metadata=processed_doc.metadata,
                    status=doc_status,
                )
                db.add(new_doc)
                await db.flush()  # assign new_doc.id

                new_chunks = self.chunker.chunk_processed_document(
                    processed_doc=processed_doc,
                    document_id=new_doc.id,
                    source_id=source.id,
                )
                db.add_all(new_chunks)
                stats["created"] += 1
                stats["chunks_created"] += len(new_chunks)

        # Detect removed files: existing files not present in the current fetch
        for old_path, old_doc in existing_docs.items():
            if old_path not in fetched_paths and old_doc.status != "removed":
                old_doc.status = "removed"
                stats["removed"] += 1

        await db.flush()
        return stats


_global_ingestion_service: IngestionService | None = None


def get_ingestion_service() -> IngestionService:
    global _global_ingestion_service
    if _global_ingestion_service is None:
        _global_ingestion_service = IngestionService()
    return _global_ingestion_service
