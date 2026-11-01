import logging
import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.gemini import GeminiClient, get_gemini_client
from app.integrations.qdrant import QdrantStore, get_qdrant_store
from app.models.document import Document, DocumentChunk
from app.models.enums import KnowledgeCategory, KnowledgeReviewStatus
from app.models.knowledge import KnowledgeItem
from app.schemas.knowledge import KnowledgeItemRead
from app.schemas.search import (
    CitationRead,
    QARequest,
    QAResponse,
    SearchResultItem,
)
from app.services.evidence_verifier import verify_evidence

logger = logging.getLogger(__name__)


class RetrievalService:
    """Orchestrates hybrid retrieval (Qdrant semantic search + PostgreSQL full-text search)

    and grounded contextual Q&A with programmatic citation verification.
    """

    def __init__(
        self,
        gemini_client: GeminiClient | None = None,
        qdrant_store: QdrantStore | None = None,
    ) -> None:
        self.gemini = gemini_client or get_gemini_client()
        self.qdrant = qdrant_store or get_qdrant_store()

    async def search_hybrid(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        query_text: str,
        top_k: int = 10,
        categories: list[KnowledgeCategory] | None = None,
        source_ids: list[uuid.UUID] | None = None,
        verified_only: bool = False,
    ) -> tuple[list[SearchResultItem], str]:
        """Executes hybrid retrieval combining Qdrant vector search and PostgreSQL keyword search.

        Returns (ranked_results, retrieval_mode).
        ALL searches filter by project_id for strict tenant isolation.
        """
        clean_query = query_text.strip()
        category_strs = [c.value for c in categories] if categories else None

        # -------------------------------------------------------------
        # 1. Dense Semantic Search via Qdrant
        # -------------------------------------------------------------
        vector_results: list[dict[str, Any]] = []
        vector_search_succeeded = False

        if getattr(self.gemini, "api_key", None):
            try:
                query_vector = await self.gemini.embed_query(clean_query)
                scored_points = await self.qdrant.search(
                    project_id=project_id,
                    query_vector=query_vector,
                    limit=top_k * 2,
                    verified_only=verified_only,
                )
                for pt in scored_points:
                    payload = pt.payload or {}
                    # Filter by category if requested
                    if (
                        category_strs
                        and payload.get("category")
                        and payload.get("category") not in category_strs
                    ):
                        continue
                    if source_ids and payload.get("source_id"):
                        try:
                            s_uuid = uuid.UUID(payload["source_id"])
                            if s_uuid not in source_ids:
                                continue
                        except Exception:
                            pass

                    vector_results.append(
                        {
                            "id": pt.id,
                            "score": float(pt.score),
                            "payload": payload,
                        }
                    )
                vector_search_succeeded = True
            except Exception as exc:
                logger.warning(
                    "Qdrant vector search failed for project %s: %s. Falling back to keyword search.",
                    project_id,
                    exc,
                )
                vector_search_succeeded = False
        else:
            logger.info("GEMINI_API_KEY not configured. Falling back to keyword search.")
            vector_search_succeeded = False

        # -------------------------------------------------------------
        # 2. Sparse / Keyword Search via PostgreSQL Full-Text Search
        # -------------------------------------------------------------
        keyword_results: list[dict[str, Any]] = []

        try:
            # Document chunks keyword search
            chunk_ts_vec = func.to_tsvector("english", DocumentChunk.content)
            chunk_ts_query = func.plainto_tsquery("english", clean_query)
            chunk_kw_q = (
                select(
                    DocumentChunk,
                    Document,
                    func.ts_rank(chunk_ts_vec, chunk_ts_query).label("rank"),
                )
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    Document.project_id == project_id,
                    Document.status != "removed",
                    or_(
                        chunk_ts_vec.op("@@")(chunk_ts_query),
                        DocumentChunk.content.ilike(f"%{clean_query}%"),
                        Document.title.ilike(f"%{clean_query}%"),
                    ),
                )
                .order_by(func.ts_rank(chunk_ts_vec, chunk_ts_query).desc())
                .limit(top_k * 2)
            )
            if source_ids:
                chunk_kw_q = chunk_kw_q.where(Document.source_id.in_(source_ids))

            res_chunks = await db.execute(chunk_kw_q)
            for chunk, doc, rank_score in res_chunks.all():
                keyword_results.append(
                    {
                        "id": str(chunk.id),
                        "entity_type": "chunk",
                        "title": doc.title,
                        "content": chunk.content,
                        "file_path": doc.file_path or doc.title,
                        "location_info": chunk.location_info,
                        "category": None,
                        "verified": True,
                        "document_id": doc.id,
                        "chunk_id": chunk.id,
                        "knowledge_item_id": None,
                        "score": float(rank_score or 0.1),
                    }
                )

            # Knowledge items keyword search
            kitem_ts_vec = func.to_tsvector(
                "english",
                func.concat(KnowledgeItem.title, " ", KnowledgeItem.description),
            )
            kitem_ts_query = func.plainto_tsquery("english", clean_query)
            kitem_kw_q = (
                select(
                    KnowledgeItem,
                    func.ts_rank(kitem_ts_vec, kitem_ts_query).label("rank"),
                )
                .where(
                    KnowledgeItem.project_id == project_id,
                    or_(
                        kitem_ts_vec.op("@@")(kitem_ts_query),
                        KnowledgeItem.title.ilike(f"%{clean_query}%"),
                        KnowledgeItem.description.ilike(f"%{clean_query}%"),
                    ),
                )
                .order_by(func.ts_rank(kitem_ts_vec, kitem_ts_query).desc())
                .limit(top_k * 2)
            )
            if category_strs:
                kitem_kw_q = kitem_kw_q.where(KnowledgeItem.category.in_(categories))

            res_kitems = await db.execute(kitem_kw_q)
            for kitem, rank_score in res_kitems.all():
                is_v = (kitem.review_status == KnowledgeReviewStatus.APPROVED) or (
                    not kitem.review_note or "[UNVERIFIED_EVIDENCE]" not in kitem.review_note
                )
                keyword_results.append(
                    {
                        "id": str(kitem.id),
                        "entity_type": "knowledge_item",
                        "title": kitem.title,
                        "content": kitem.description,
                        "file_path": None,
                        "location_info": {},
                        "category": kitem.category,
                        "verified": is_v,
                        "review_status": kitem.review_status,
                        "document_id": None,
                        "chunk_id": None,
                        "knowledge_item_id": kitem.id,
                        "score": float(rank_score or 0.1),
                    }
                )
        except Exception as kw_exc:
            logger.error("Keyword search failed for project %s: %s", project_id, kw_exc)

        # -------------------------------------------------------------
        # 3. Reciprocal Rank Fusion (RRF) & Merging
        # -------------------------------------------------------------
        rrf_scores: dict[str, float] = {}
        candidate_meta: dict[str, dict[str, Any]] = {}
        k = 60.0  # standard RRF constant

        # Rank vector results
        for rank_idx, v_item in enumerate(vector_results, start=1):
            key = str(v_item["id"])
            rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (k + rank_idx))
            p = v_item["payload"]
            cid = uuid.UUID(p["chunk_id"]) if p.get("chunk_id") else None
            did = uuid.UUID(p["document_id"]) if p.get("document_id") else None
            kid = uuid.UUID(p["knowledge_item_id"]) if p.get("knowledge_item_id") else None
            cat_enum = None
            if p.get("category"):
                try:
                    cat_enum = KnowledgeCategory(p["category"])
                except Exception:
                    pass

            candidate_meta[key] = {
                "id": uuid.UUID(key),
                "entity_type": p.get("entity_type", "chunk"),
                "title": p.get("title", ""),
                "content": p.get("content", ""),
                "file_path": p.get("file_path"),
                "location_info": p.get("location_info", {}),
                "category": cat_enum,
                "verified": bool(p.get("verified", False)),
                "document_id": did,
                "chunk_id": cid,
                "knowledge_item_id": kid,
                "review_status": p.get("review_status"),
            }

        # Rank keyword results
        for rank_idx, kw_item in enumerate(keyword_results, start=1):
            key = str(kw_item["id"])
            rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (k + rank_idx))
            if key not in candidate_meta:
                candidate_meta[key] = kw_item

        # Curated knowledge boost: Boost approved knowledge items by 1.25x
        for key, meta in candidate_meta.items():
            if meta.get("entity_type") == "knowledge_item":
                status = meta.get("review_status")
                if status in (KnowledgeReviewStatus.APPROVED, "approved"):
                    rrf_scores[key] = rrf_scores.get(key, 0.0) * 1.30
                else:
                    rrf_scores[key] = rrf_scores.get(key, 0.0) * 1.10

        # Sort candidates by combined score
        sorted_keys = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        top_keys = sorted_keys[:top_k]

        ranked_items: list[SearchResultItem] = []
        for key in top_keys:
            meta = candidate_meta[key]
            ranked_items.append(
                SearchResultItem(
                    id=uuid.UUID(str(meta["id"])),
                    entity_type=meta.get("entity_type", "chunk"),
                    title=meta.get("title", ""),
                    content=meta.get("content", ""),
                    file_path=meta.get("file_path"),
                    location_info=meta.get("location_info", {}),
                    category=meta.get("category"),
                    score=round(rrf_scores[key], 4),
                    verified=bool(meta.get("verified", False)),
                    document_id=meta.get("document_id"),
                    chunk_id=meta.get("chunk_id"),
                    knowledge_item_id=meta.get("knowledge_item_id"),
                )
            )

        # Determine retrieval mode indicator
        if vector_search_succeeded and keyword_results:
            retrieval_mode = "hybrid"
        elif vector_search_succeeded and not keyword_results:
            retrieval_mode = "vector_only"
        else:
            retrieval_mode = "keyword_fallback"

        return ranked_items, retrieval_mode

    async def answer_question(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        request: QARequest,
    ) -> QAResponse:
        """Executes contextual grounded Q&A with programmatic evidence citation verification."""
        # 1. Retrieve relevant context via hybrid search
        ranked_results, retrieval_mode = await self.search_hybrid(
            db=db,
            project_id=project_id,
            query_text=request.question,
            top_k=request.top_k,
            categories=request.categories,
            source_ids=request.source_ids,
            verified_only=request.verified_only,
        )

        if not ranked_results:
            return QAResponse(
                question=request.question,
                answer="I do not have sufficient information in the provided context to answer this question.",
                is_sufficient=False,
                confidence=0.0,
                citations=[],
                related_knowledge_items=[],
                retrieval_mode=retrieval_mode,
                retrieved_count=0,
            )

        # 2. Format context for Gemini
        chunk_snippets: list[str] = []
        kitem_snippets: list[str] = []
        knowledge_item_ids: list[uuid.UUID] = []

        for item in ranked_results:
            if item.entity_type == "chunk":
                loc_str = str(item.location_info) if item.location_info else ""
                chunk_snippets.append(
                    f"[Chunk ID: {item.chunk_id or item.id}]\n"
                    f"Document: {item.title} ({item.file_path or 'unknown'})\n"
                    f"Location: {loc_str}\n"
                    f"Content:\n{item.content}\n"
                )
            else:
                kitem_snippets.append(
                    f"[Knowledge Item ID: {item.knowledge_item_id or item.id}]\n"
                    f"Category: {item.category.value if item.category else 'insight'}\n"
                    f"Title: {item.title}\n"
                    f"Description: {item.content}\n"
                )
                if item.knowledge_item_id:
                    knowledge_item_ids.append(item.knowledge_item_id)
                else:
                    knowledge_item_ids.append(item.id)

        # Format conversation history
        history_lines: list[str] = []
        if request.conversation_history:
            for msg in request.conversation_history[-5:]:  # Keep small: last 5 turns
                history_lines.append(f"{msg.role.capitalize()}: {msg.content}")
        history_str = "\n".join(history_lines) if history_lines else "None"

        # 3. Call Gemini Q&A
        if not getattr(self.gemini, "api_key", None):
            logger.info("GEMINI_API_KEY is not configured. Returning retrieved context summary.")
            answer_text = (
                "GEMINI_API_KEY is not configured on the server. "
                "Retrieved context items are available in citations and search results below."
            )
            grounded_res = None
        else:
            try:
                grounded_res = await self.gemini.answer_contextual_qa(
                    question=request.question,
                    chunks_context="\n---\n".join(chunk_snippets),
                    knowledge_context="\n---\n".join(kitem_snippets),
                    history_context=history_str,
                )
                answer_text = grounded_res.answer
            except Exception as exc:
                logger.error("Gemini contextual Q&A call failed: %s", exc)
                answer_text = (
                    "Could not generate an AI answer at this time. "
                    "Relevant source citations have been retrieved below."
                )
                grounded_res = None

        # 4. Programmatic Verification of Citations
        # Every cited excerpt is checked against retrieved chunk contents
        all_chunk_contents = " \n ".join([item.content for item in ranked_results])
        verified_citations: list[CitationRead] = []

        if grounded_res and grounded_res.citations:
            for raw_cite in grounded_res.citations:
                matched_item = next(
                    (
                        r
                        for r in ranked_results
                        if str(r.chunk_id or r.id) == str(raw_cite.chunk_id)
                        or (r.file_path and r.file_path == raw_cite.file_path)
                    ),
                    ranked_results[0],
                )

                # Programmatically verify that excerpt exists in the chunk content
                is_v, score, verified_excerpt = verify_evidence(
                    chunk_content=matched_item.content,
                    excerpt=raw_cite.exact_excerpt,
                )
                # Fallback check against entire retrieved context
                if not is_v and raw_cite.exact_excerpt:
                    is_v, score, verified_excerpt = verify_evidence(
                        chunk_content=all_chunk_contents,
                        excerpt=raw_cite.exact_excerpt,
                    )

                verified_citations.append(
                    CitationRead(
                        document_id=matched_item.document_id,
                        chunk_id=matched_item.chunk_id,
                        knowledge_item_id=matched_item.knowledge_item_id,
                        document_title=matched_item.title,
                        file_path=matched_item.file_path
                        or raw_cite.file_path
                        or matched_item.title,
                        location_info=matched_item.location_info,
                        exact_excerpt=verified_excerpt if is_v else raw_cite.exact_excerpt,
                        verified=is_v,
                        relevance_score=matched_item.score,
                    )
                )

        # If model did not emit citations or LLM was unavailable, generate citations directly from top ranked items
        if not verified_citations:
            for item in ranked_results[:3]:
                sample_excerpt = item.content[:200].strip() + (
                    "..." if len(item.content) > 200 else ""
                )
                verified_citations.append(
                    CitationRead(
                        document_id=item.document_id,
                        chunk_id=item.chunk_id,
                        knowledge_item_id=item.knowledge_item_id,
                        document_title=item.title,
                        file_path=item.file_path or item.title,
                        location_info=item.location_info,
                        exact_excerpt=sample_excerpt,
                        verified=True,
                        relevance_score=item.score,
                    )
                )

        # 5. Fetch related KnowledgeItems from PostgreSQL
        related_kitems: list[KnowledgeItemRead] = []
        if knowledge_item_ids:
            kitem_objs_q = (
                select(KnowledgeItem)
                .options(selectinload(KnowledgeItem.evidences))
                .where(
                    KnowledgeItem.project_id == project_id,
                    KnowledgeItem.id.in_(knowledge_item_ids),
                )
            )
            res_kobjs = await db.execute(kitem_objs_q)
            for kobj in res_kobjs.scalars().all():
                related_kitems.append(KnowledgeItemRead.model_validate(kobj))

        is_sufficient = grounded_res.is_sufficient if grounded_res else bool(ranked_results)
        confidence = grounded_res.confidence if grounded_res else (0.85 if ranked_results else 0.0)

        # Out of domain check: if model says it doesn't know, enforce is_sufficient=False and confidence=0.0
        if "do not have sufficient information" in answer_text.lower():
            is_sufficient = False
            confidence = 0.0

        return QAResponse(
            question=request.question,
            answer=answer_text,
            is_sufficient=is_sufficient,
            confidence=confidence,
            citations=verified_citations,
            related_knowledge_items=related_kitems,
            retrieval_mode=retrieval_mode,
            retrieved_count=len(ranked_results),
        )


_global_retrieval_service: RetrievalService | None = None


def get_retrieval_service() -> RetrievalService:
    global _global_retrieval_service
    if _global_retrieval_service is None:
        _global_retrieval_service = RetrievalService()
    return _global_retrieval_service
