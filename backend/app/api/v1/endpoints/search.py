import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.core.rate_limit import rate_limit_expensive
from app.db.session import get_db
from app.models.enums import KnowledgeCategory, ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.search import (
    QARequest,
    QAResponse,
    ReindexResponse,
    SearchResultsResponse,
)
from app.services.indexing_service import IndexingService, get_indexing_service
from app.services.retrieval_service import RetrievalService, get_retrieval_service

router = APIRouter()


@router.post(
    "/{project_id}/search",
    response_model=QAResponse | SearchResultsResponse,
    summary="Contextual Q&A and hybrid retrieval endpoint",
    dependencies=[Depends(rate_limit_expensive)],
)
async def project_search_or_qa(
    project_id: uuid.UUID,
    search_req: QARequest,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Executes either grounded contextual Q&A (default) or plain ranked search.

    ALL searches are strictly partitioned by project_id.
    """
    if search_req.include_answer:
        # Contextual grounded Q&A with citations
        qa_response = await retrieval_service.answer_question(
            db=db,
            project_id=project_id,
            request=search_req,
        )
        return qa_response
    else:
        # Plain ranked evidence-linked search results (no LLM generation)
        results, retrieval_mode = await retrieval_service.search_hybrid(
            db=db,
            project_id=project_id,
            query_text=search_req.question,
            top_k=search_req.top_k,
            categories=search_req.categories,
            source_ids=search_req.source_ids,
            verified_only=search_req.verified_only,
        )
        return SearchResultsResponse(
            query=search_req.question,
            total_results=len(results),
            retrieval_mode=retrieval_mode,  # type: ignore[arg-type]
            results=results,
        )


@router.get(
    "/{project_id}/search",
    response_model=SearchResultsResponse,
    summary="Plain search endpoint returning ranked evidence-linked results",
)
async def project_plain_search(
    project_id: uuid.UUID,
    q: str = Query(..., min_length=1, description="Search query string"),
    category: KnowledgeCategory | None = Query(None, description="Optional category filter"),
    verified_only: bool = Query(False, description="Filter only verified items"),
    limit: int = Query(10, ge=1, le=50, description="Max results to return"),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
    db: AsyncSession = Depends(get_db),
) -> SearchResultsResponse:
    """Plain keyword + semantic hybrid search endpoint for search boxes."""
    categories = [category] if category else None

    results, retrieval_mode = await retrieval_service.search_hybrid(
        db=db,
        project_id=project_id,
        query_text=q,
        top_k=limit,
        categories=categories,
        verified_only=verified_only,
    )
    return SearchResultsResponse(
        query=q,
        total_results=len(results),
        retrieval_mode=retrieval_mode,  # type: ignore[arg-type]
        results=results,
    )


@router.post(
    "/{project_id}/reindex",
    response_model=ReindexResponse,
    status_code=status.HTTP_200_OK,
    summary="Reindex all project chunks and knowledge items into Qdrant",
    dependencies=[Depends(rate_limit_expensive)],
)
async def reindex_project(
    project_id: uuid.UUID,
    force_all: bool = Query(
        False, description="Whether to recreate collection and force reindex all items"
    ),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.ADMIN)),
    indexing_service: IndexingService = Depends(get_indexing_service),
    db: AsyncSession = Depends(get_db),
) -> ReindexResponse:
    stats = await indexing_service.index_project_content(
        db=db,
        project_id=project_id,
        force_all=force_all,
    )
    return ReindexResponse(
        project_id=project_id,
        chunks_indexed=stats.get("chunks_indexed", 0),
        knowledge_items_indexed=stats.get("knowledge_items_indexed", 0),
        vectors_deleted=stats.get("vectors_deleted", 0),
        collection_name=stats.get("collection_name", "projectx_knowledge"),
        model_name=stats.get("model_name", "text-embedding-004"),
        dimension=stats.get("dimension", 768),
        status=stats.get("status", "completed"),
    )
