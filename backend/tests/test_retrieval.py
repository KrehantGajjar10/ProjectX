import hashlib
import math
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.qdrant import QdrantStore
from app.models.document import Document, DocumentChunk
from app.models.enums import KnowledgeCategory, KnowledgeReviewStatus, ProjectRole
from app.models.knowledge import KnowledgeItem
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.source import Source
from app.models.user import User
from app.schemas.search import (
    GroundedCitationItem,
    GroundedQAResult,
    QARequest,
)
from app.services.indexing_service import IndexingService
from app.services.retrieval_service import RetrievalService


def deterministic_text_embedding(text: str, dim: int = 768) -> list[float]:
    """Generates a deterministic, normalized 768-dim float vector based on text token hashes."""
    vec = [0.0] * dim
    tokens = text.lower().split()
    if not tokens:
        tokens = ["empty"]
    for token in tokens:
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


class FakeGeminiRetrievalClient:
    """Mock Gemini client providing deterministic embeddings and grounded Q&A responses."""

    def __init__(self, api_key: str = "fake-test-key") -> None:
        self.api_key = api_key
        self.model_name = "gemini-2.5-flash"
        self.embedding_model = settings.GEMINI_EMBEDDING_MODEL
        self.embedding_dimension = settings.GEMINI_EMBEDDING_DIMENSION

    async def embed_texts(
        self, texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[list[float]]:
        return [deterministic_text_embedding(t, self.embedding_dimension) for t in texts]

    async def embed_query(self, query: str) -> list[float]:
        return deterministic_text_embedding(query, self.embedding_dimension)

    async def answer_contextual_qa(
        self,
        question: str,
        chunks_context: str,
        knowledge_context: str,
        history_context: str = "None",
    ) -> GroundedQAResult:
        q_lower = question.lower()
        if "database" in q_lower or "postgresql" in q_lower:
            return GroundedQAResult(
                answer="The project uses PostgreSQL 17 as the primary transactional database.",
                is_sufficient=True,
                confidence=0.98,
                citations=[
                    GroundedCitationItem(
                        document_title="architecture.md",
                        file_path="docs/architecture.md",
                        exact_excerpt="We have officially chosen PostgreSQL 17 as the primary transactional database.",
                    )
                ],
            )
        elif "quantum" in q_lower or "mars" in q_lower:
            # Out of domain question
            return GroundedQAResult(
                answer="I do not have sufficient information in the provided context to answer this question.",
                is_sufficient=False,
                confidence=0.0,
                citations=[],
            )
        elif "hallucinated" in q_lower:
            # Model attempts to cite something not in context
            return GroundedQAResult(
                answer="This is a test of hallucinated citation verification.",
                is_sufficient=True,
                confidence=0.80,
                citations=[
                    GroundedCitationItem(
                        document_title="architecture.md",
                        file_path="docs/architecture.md",
                        exact_excerpt="This exact sentence does not exist anywhere in the source files.",
                    )
                ],
            )
        else:
            return GroundedQAResult(
                answer=f"Based on the provided context: {question}",
                is_sufficient=True,
                confidence=0.90,
                citations=[],
            )


# Helper to create test chunks
async def create_document_with_chunk(
    db: AsyncSession,
    project: Project,
    title: str,
    file_path: str,
    content: str,
) -> tuple[Document, DocumentChunk]:
    source = Source(
        project_id=project.id,
        name=f"Source {title}",
        type="upload",
        config={"files": [file_path]},
    )
    db.add(source)
    await db.flush()

    doc = Document(
        project_id=project.id,
        source_id=source.id,
        title=title,
        file_path=file_path,
        content_hash=f"hash_{uuid.uuid4().hex[:8]}",
        status="parsed",
        doc_metadata={"file_type": "markdown"},
    )
    db.add(doc)
    await db.flush()

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content=content,
        token_count=len(content.split()),
        location_info={"file_path": file_path, "start_line": 1, "end_line": 5},
    )
    db.add(chunk)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(chunk)
    return doc, chunk


# 1. Qdrant Collection & Model Verification Test
@pytest.mark.asyncio
async def test_qdrant_collection_init_and_verification():
    qstore = QdrantStore(collection_name="test_verification_collection")
    try:
        # Initial creation
        await qstore.verify_or_init_collection(force_recreate=True)
        meta = await qstore.get_index_metadata()
        assert meta is not None
        assert meta["model_name"] == settings.GEMINI_EMBEDDING_MODEL
        assert meta["dimension"] == settings.GEMINI_EMBEDDING_DIMENSION

        # Re-verification with same settings succeeds
        await qstore.verify_or_init_collection()

    finally:
        try:
            await qstore.client.delete_collection("test_verification_collection")
        except Exception:
            pass
        await qstore.close()


# 2. Multi-Tenant Project Isolation Test
@pytest.mark.asyncio
async def test_semantic_indexing_and_project_isolation(
    db_session: AsyncSession,
    project_a: Project,
    user_b: User,
):
    # Create Project B
    project_b = Project(
        name="Project Secret B",
        description="Confidential Project B",
        created_by_id=user_b.id,
    )
    db_session.add(project_b)
    await db_session.flush()

    # Chunks for Project A (PostgreSQL)
    await create_document_with_chunk(
        db_session,
        project_a,
        "Project A Architecture",
        "docs/arch_a.md",
        "Project Apollo uses PostgreSQL 17 for relational storage and JSONB indexing.",
    )

    # Chunks for Project B (Confidential Redis)
    await create_document_with_chunk(
        db_session,
        project_b,
        "Project B Architecture",
        "docs/arch_b.md",
        "Project Confidential B strictly uses Redis Enterprise cluster for secret caching.",
    )

    fake_gemini = FakeGeminiClientRetrieval()
    qstore = QdrantStore(collection_name="test_isolation_collection")
    await qstore.verify_or_init_collection(force_recreate=True)

    indexing_service = IndexingService(gemini_client=fake_gemini, qdrant_store=qstore)

    try:
        # Index both projects
        stats_a = await indexing_service.index_project_content(db_session, project_a.id)
        stats_b = await indexing_service.index_project_content(db_session, project_b.id)

        assert stats_a["chunks_indexed"] == 1
        assert stats_b["chunks_indexed"] == 1

        retrieval_service = RetrievalService(gemini_client=fake_gemini, qdrant_store=qstore)

        # Search Project A for "Redis" (only present in Project B)
        results_in_a, _ = await retrieval_service.search_hybrid(
            db=db_session,
            project_id=project_a.id,
            query_text="Redis secret caching",
        )
        # MUST NEVER return Project B content!
        for r in results_in_a:
            assert "Project Confidential B" not in r.title
            assert "Redis Enterprise" not in r.content

        # Search Project B for "Redis"
        results_in_b, _ = await retrieval_service.search_hybrid(
            db=db_session,
            project_id=project_b.id,
            query_text="Redis secret caching",
        )
        assert len(results_in_b) >= 1
        assert any("Redis Enterprise" in r.content for r in results_in_b)

    finally:
        try:
            await qstore.client.delete_collection("test_isolation_collection")
        except Exception:
            pass
        await qstore.close()


# 3. Hybrid Retrieval & Fallback Behavior Test
@pytest.mark.asyncio
async def test_hybrid_ranking_and_fallback(
    db_session: AsyncSession,
    project_a: Project,
):
    # Add raw chunk
    await create_document_with_chunk(
        db_session,
        project_a,
        "FastAPI Documentation",
        "docs/fastapi.md",
        "We selected FastAPI framework for building async REST services in Python.",
    )

    # Add approved KnowledgeItem
    kitem = KnowledgeItem(
        project_id=project_a.id,
        category=KnowledgeCategory.DECISION,
        title="Framework Selection: FastAPI",
        description="FastAPI selected for high-throughput async microservices.",
        confidence=0.95,
        review_status=KnowledgeReviewStatus.APPROVED,
    )
    db_session.add(kitem)
    await db_session.commit()

    # Test fallback when Gemini API key is missing
    gemini_no_key = FakeGeminiClientRetrieval(api_key="")
    retrieval_service_fallback = RetrievalService(gemini_client=gemini_no_key)

    results, mode = await retrieval_service_fallback.search_hybrid(
        db=db_session,
        project_id=project_a.id,
        query_text="FastAPI",
    )

    assert mode == "keyword_fallback"
    assert len(results) >= 1
    # Curated knowledge item must be ranked at the top due to boost
    assert any(r.entity_type == "knowledge_item" for r in results)


# 4. Contextual Q&A Endpoint & Citations Test
@pytest.mark.asyncio
async def test_contextual_qa_endpoint_with_grounded_citations(
    client: AsyncClient,
    db_session: AsyncSession,
    project_a: Project,
    auth_headers_a: dict[str, str],
    monkeypatch,
):
    await create_document_with_chunk(
        db_session,
        project_a,
        "architecture.md",
        "docs/architecture.md",
        "We have officially chosen PostgreSQL 17 as the primary transactional database.\n"
        "It provides robust ACID compliance and native JSONB indexing.",
    )

    # Inject fake gemini and qdrant
    fake_gemini = FakeGeminiClientRetrieval()
    qstore = QdrantStore(collection_name="test_qa_collection")
    await qstore.verify_or_init_collection(force_recreate=True)

    indexing_service = IndexingService(gemini_client=fake_gemini, qdrant_store=qstore)
    await indexing_service.index_project_content(db_session, project_a.id)

    test_retrieval_svc = RetrievalService(gemini_client=fake_gemini, qdrant_store=qstore)
    from app.main import app
    from app.services.retrieval_service import get_retrieval_service

    app.dependency_overrides[get_retrieval_service] = lambda: test_retrieval_svc

    try:
        # Question that data CAN answer
        resp = await client.post(
            f"/api/v1/projects/{project_a.id}/search",
            headers=auth_headers_a,
            json={
                "question": "What database are we using?",
                "include_answer": True,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "PostgreSQL 17" in data["answer"]
        assert data["is_sufficient"] is True
        assert data["confidence"] > 0.90
        assert len(data["citations"]) >= 1

        citation = data["citations"][0]
        assert citation["verified"] is True
        assert "PostgreSQL 17" in citation["exact_excerpt"]

        # Question that data CANNOT answer (out of domain)
        resp_nodata = await client.post(
            f"/api/v1/projects/{project_a.id}/search",
            headers=auth_headers_a,
            json={
                "question": "How do we deploy quantum algorithms to Mars?",
                "include_answer": True,
            },
        )
        assert resp_nodata.status_code == 200
        nodata = resp_nodata.json()
        assert nodata["is_sufficient"] is False
        assert nodata["confidence"] == 0.0
        assert "not have sufficient information" in nodata["answer"].lower()

    finally:
        app.dependency_overrides.pop(get_retrieval_service, None)
        try:
            await qstore.client.delete_collection("test_qa_collection")
        except Exception:
            pass
        await qstore.close()


# 5. Citation Verification Catches Hallucinations Test
@pytest.mark.asyncio
async def test_citation_verification_detects_unsupported_excerpts(
    db_session: AsyncSession,
    project_a: Project,
):
    await create_document_with_chunk(
        db_session,
        project_a,
        "security.md",
        "docs/security.md",
        "All API secrets must be injected through environment variables.",
    )

    fake_gemini = FakeGeminiClientRetrieval()
    qstore = QdrantStore(collection_name="test_cite_hallucination_col")
    await qstore.verify_or_init_collection(force_recreate=True)

    indexing_service = IndexingService(gemini_client=fake_gemini, qdrant_store=qstore)
    await indexing_service.index_project_content(db_session, project_a.id)

    retrieval_svc = RetrievalService(gemini_client=fake_gemini, qdrant_store=qstore)

    try:
        # Question that triggers fake client to return a hallucinated citation
        qa_req = QARequest(
            question="Tell me about hallucinated citations",
            include_answer=True,
        )
        qa_res = await retrieval_svc.answer_question(db_session, project_a.id, qa_req)

        assert len(qa_res.citations) >= 1
        # The hallucinated citation must be detected and marked verified=False
        hallucinated_cite = qa_res.citations[0]
        assert hallucinated_cite.verified is False

    finally:
        try:
            await qstore.client.delete_collection("test_cite_hallucination_col")
        except Exception:
            pass
        await qstore.close()


# 6. Plain Search Endpoints Test
@pytest.mark.asyncio
async def test_plain_search_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    project_a: Project,
    auth_headers_a: dict[str, str],
):
    await create_document_with_chunk(
        db_session,
        project_a,
        "docker.md",
        "docs/docker.md",
        "Docker Compose is configured for PostgreSQL 17 and Qdrant containers.",
    )

    # 1. GET /search
    resp_get = await client.get(
        f"/api/v1/projects/{project_a.id}/search?q=Docker",
        headers=auth_headers_a,
    )
    assert resp_get.status_code == 200
    data_get = resp_get.json()
    assert data_get["query"] == "Docker"
    assert data_get["total_results"] >= 1
    assert any("Docker Compose" in r["content"] for r in data_get["results"])

    # 2. POST /search with include_answer=False
    resp_post = await client.post(
        f"/api/v1/projects/{project_a.id}/search",
        headers=auth_headers_a,
        json={"question": "Docker", "include_answer": False},
    )
    assert resp_post.status_code == 200
    data_post = resp_post.json()
    assert data_post["query"] == "Docker"
    assert data_post["total_results"] >= 1


# 7. Reindex Endpoint and Role Permissions Test
@pytest.mark.asyncio
async def test_reindex_endpoint_permissions(
    client: AsyncClient,
    db_session: AsyncSession,
    project_a: Project,
    auth_headers_a: dict[str, str],
    user_b: User,
    auth_headers_b: dict[str, str],
):
    # User B is not an admin on project_a -> 403 Forbidden
    resp_forbidden = await client.post(
        f"/api/v1/projects/{project_a.id}/reindex",
        headers=auth_headers_b,
    )
    assert resp_forbidden.status_code == 403

    # Add User B as MEMBER -> 403 Forbidden
    member_b = ProjectMember(project_id=project_a.id, user_id=user_b.id, role=ProjectRole.MEMBER)
    db_session.add(member_b)
    await db_session.commit()

    resp_still_forbidden = await client.post(
        f"/api/v1/projects/{project_a.id}/reindex",
        headers=auth_headers_b,
    )
    assert resp_still_forbidden.status_code == 403

    # User A is OWNER -> 200 OK
    resp_ok = await client.post(
        f"/api/v1/projects/{project_a.id}/reindex?force_all=false",
        headers=auth_headers_a,
    )
    assert resp_ok.status_code == 200
    data = resp_ok.json()
    assert data["status"] == "completed"
    assert data["project_id"] == str(project_a.id)


FakeGeminiClientRetrieval = FakeGeminiRetrievalClient
