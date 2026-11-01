import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import KnowledgeCategory
from app.schemas.knowledge import KnowledgeItemRead


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class GroundedCitationItem(BaseModel):
    chunk_id: str | None = None
    knowledge_item_id: str | None = None
    document_title: str = ""
    file_path: str = ""
    exact_excerpt: str = ""


class GroundedQAResult(BaseModel):
    answer: str
    is_sufficient: bool = True
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    citations: list[GroundedCitationItem] = Field(default_factory=list)


class CitationRead(BaseModel):
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None
    knowledge_item_id: uuid.UUID | None = None
    document_title: str
    file_path: str
    location_info: dict[str, Any] = Field(default_factory=dict)
    exact_excerpt: str
    verified: bool = False
    relevance_score: float = 0.0


class QARequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    categories: list[KnowledgeCategory] | None = None
    source_ids: list[uuid.UUID] | None = None
    verified_only: bool = False
    top_k: int = Field(default=5, ge=1, le=20)
    include_answer: bool = True
    conversation_history: list[ChatMessage] | None = None


class QAResponse(BaseModel):
    question: str
    answer: str
    is_sufficient: bool
    confidence: float
    citations: list[CitationRead] = Field(default_factory=list)
    related_knowledge_items: list[KnowledgeItemRead] = Field(default_factory=list)
    retrieval_mode: Literal["hybrid", "vector_only", "keyword_fallback"]
    retrieved_count: int


class SearchResultItem(BaseModel):
    id: uuid.UUID
    entity_type: str  # "chunk" or "knowledge_item"
    title: str
    content: str
    file_path: str | None = None
    location_info: dict[str, Any] = Field(default_factory=dict)
    category: KnowledgeCategory | None = None
    score: float
    verified: bool = False
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None
    knowledge_item_id: uuid.UUID | None = None


class SearchResultsResponse(BaseModel):
    query: str
    total_results: int
    retrieval_mode: Literal["hybrid", "vector_only", "keyword_fallback"]
    results: list[SearchResultItem] = Field(default_factory=list)


class ReindexResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: uuid.UUID
    chunks_indexed: int
    knowledge_items_indexed: int
    vectors_deleted: int
    collection_name: str
    model_name: str
    dimension: int
    status: str
