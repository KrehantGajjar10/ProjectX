import uuid
from typing import Any

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    review_status: str
    confidence: float = 1.0
    status: str | None = None
    metadata_info: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    evidence_text: str | None = None
    review_status: str | None = None


class GraphFinding(BaseModel):
    type: str  # "circular_dependency", "blocked_chain"
    severity: str  # "critical", "high", "medium"
    title: str
    description: str
    involved_node_ids: list[uuid.UUID] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class DependencyGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    findings: list[GraphFinding] = Field(default_factory=list)
    total_nodes: int
    total_edges: int


class SubgraphResponse(BaseModel):
    center_node_id: uuid.UUID
    depth: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    upstream_count: int
    downstream_count: int
