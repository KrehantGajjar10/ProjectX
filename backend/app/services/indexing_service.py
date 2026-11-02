import logging
import uuid
from typing import Any

from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.integrations.gemini import GeminiClient, get_gemini_client
from app.integrations.qdrant import QdrantStore, get_qdrant_store
from app.models.document import Document, DocumentChunk
from app.models.enums import KnowledgeReviewStatus
from app.models.knowledge import KnowledgeItem

logger = logging.getLogger(__name__)


class IndexingService:
    """Manages vector indexing of document chunks and curated knowledge items into Qdrant."""

    def __init__(
        self,
        gemini_client: GeminiClient | None = None,
        qdrant_store: QdrantStore | None = None,
    ) -> None:
        self.gemini = gemini_client or get_gemini_client()
        self.qdrant = qdrant_store or get_qdrant_store()

    @property
    def embedding_marker(self) -> str:
        return f"{settings.GEMINI_EMBEDDING_MODEL}:{settings.GEMINI_EMBEDDING_DIMENSION}"

    async def index_project_content(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        force_all: bool = False,
    ) -> dict[str, Any]:
        """Indexes new or modified chunks and knowledge items for a project into Qdrant."""
        # 0. Check API Key configuration
        if not getattr(self.gemini, "api_key", None) and not settings.DEMO_MODE:
            logger.warning(
                "Project %s: GEMINI_API_KEY is not configured. Skipping vector indexing.",
                project_id,
            )
            return {
                "chunks_indexed": 0,
                "knowledge_items_indexed": 0,
                "vectors_deleted": 0,
                "collection_name": settings.QDRANT_COLLECTION_NAME,
                "model_name": settings.GEMINI_EMBEDDING_MODEL,
                "dimension": settings.GEMINI_EMBEDDING_DIMENSION,
                "skipped_reason": "GEMINI_API_KEY_NOT_CONFIGURED",
            }

        # 1. Initialize or verify Qdrant collection
        await self.qdrant.verify_or_init_collection(force_recreate=force_all)

        vectors_deleted = 0

        # 2. Handle deleted documents: remove vectors from Qdrant
        del_docs_q = select(Document).where(
            Document.project_id == project_id,
            Document.status == "removed",
        )
        res_del = await db.execute(del_docs_q)
        removed_docs = res_del.scalars().all()
        for r_doc in removed_docs:
            await self.qdrant.delete_by_document(project_id=project_id, document_id=r_doc.id)
            vectors_deleted += 1

        # 3. Query chunks that need indexing
        chunks_q = (
            select(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .options(selectinload(DocumentChunk.document))
            .where(
                Document.project_id == project_id,
                Document.status != "removed",
            )
        )
        if not force_all:
            chunks_q = chunks_q.where(
                (DocumentChunk.embedding_id.is_(None))
                | (DocumentChunk.embedding_id != self.embedding_marker)
            )

        res_chunks = await db.execute(chunks_q)
        unindexed_chunks = res_chunks.scalars().all()

        chunks_indexed = 0
        if unindexed_chunks:
            chunk_texts = [
                f"File: {c.document.file_path or c.document.title}\n{c.content}"
                for c in unindexed_chunks
            ]
            chunk_vectors = await self.gemini.embed_texts(
                texts=chunk_texts,
                task_type="RETRIEVAL_DOCUMENT",
            )

            points_to_upsert: list[qmodels.PointStruct] = []
            for chunk, vector in zip(unindexed_chunks, chunk_vectors, strict=False):
                payload = {
                    "project_id": str(project_id),
                    "entity_type": "chunk",
                    "document_id": str(chunk.document_id),
                    "chunk_id": str(chunk.id),
                    "source_id": str(chunk.document.source_id)
                    if chunk.document.source_id
                    else None,
                    "file_path": chunk.document.file_path or chunk.document.title,
                    "title": chunk.document.title,
                    "content": chunk.content,
                    "category": None,
                    "verified": True,
                    "location_info": chunk.location_info,
                }
                points_to_upsert.append(
                    qmodels.PointStruct(
                        id=str(chunk.id),
                        vector=vector,
                        payload=payload,
                    )
                )
                chunk.embedding_id = self.embedding_marker

            if points_to_upsert:
                await self.qdrant.upsert_points(points=points_to_upsert)
                chunks_indexed = len(points_to_upsert)

        # 4. Query and index knowledge items
        kitems_q = select(KnowledgeItem).where(KnowledgeItem.project_id == project_id)
        res_kitems = await db.execute(kitems_q)
        kitems = res_kitems.scalars().all()

        kitems_indexed = 0
        if kitems:
            kitem_texts = [
                f"Category: {item.category.value}\nTitle: {item.title}\nDescription: {item.description}"
                for item in kitems
            ]
            kitem_vectors = await self.gemini.embed_texts(
                texts=kitem_texts,
                task_type="RETRIEVAL_DOCUMENT",
            )

            kitem_points: list[qmodels.PointStruct] = []
            for item, vector in zip(kitems, kitem_vectors, strict=False):
                is_verified = (item.review_status == KnowledgeReviewStatus.APPROVED) or (
                    not item.review_note or "[UNVERIFIED_EVIDENCE]" not in item.review_note
                )
                payload = {
                    "project_id": str(project_id),
                    "entity_type": "knowledge_item",
                    "knowledge_item_id": str(item.id),
                    "title": item.title,
                    "content": item.description,
                    "category": item.category.value,
                    "verified": is_verified,
                    "review_status": item.review_status.value,
                    "confidence": item.confidence,
                    "origin": item.origin.value,
                    "location_info": {},
                }
                kitem_points.append(
                    qmodels.PointStruct(
                        id=str(item.id),
                        vector=vector,
                        payload=payload,
                    )
                )

            if kitem_points:
                await self.qdrant.upsert_points(points=kitem_points)
                kitems_indexed = len(kitem_points)

        await db.commit()

        logger.info(
            "Project %s indexing complete: %d chunks, %d knowledge items, %d vectors removed",
            project_id,
            chunks_indexed,
            kitems_indexed,
            vectors_deleted,
        )

        return {
            "chunks_indexed": chunks_indexed,
            "knowledge_items_indexed": kitems_indexed,
            "vectors_deleted": vectors_deleted,
            "collection_name": settings.QDRANT_COLLECTION_NAME,
            "model_name": settings.GEMINI_EMBEDDING_MODEL,
            "dimension": settings.GEMINI_EMBEDDING_DIMENSION,
            "status": "completed",
        }


_global_indexing_service: IndexingService | None = None


def get_indexing_service() -> IndexingService:
    global _global_indexing_service
    if _global_indexing_service is None:
        _global_indexing_service = IndexingService()
    return _global_indexing_service
