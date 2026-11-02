import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_project_role
from app.db.session import get_db
from app.models.enums import KnowledgeCategory, KnowledgeReviewStatus, ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.schemas.graph import DependencyGraphResponse, SubgraphResponse
from app.services.graph_service import get_graph_service
from app.services.neo4j_sync_service import get_neo4j_sync_service

router = APIRouter()


@router.get(
    "/{project_id}/dependencies/graph",
    response_model=DependencyGraphResponse,
    summary="Get project dependency graph with cycle detection and blocked chain findings",
)
async def get_project_dependency_graph(
    project_id: uuid.UUID,
    category: KnowledgeCategory | None = Query(None, description="Optional category filter"),
    review_status: KnowledgeReviewStatus | None = Query(
        None, description="Optional review status filter"
    ),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> DependencyGraphResponse:
    """Returns project dependency graph as nodes, edges, circular dependencies, and blocked chains."""
    graph_service = get_graph_service()
    return await graph_service.get_project_graph(
        db=db,
        project_id=project_id,
        category=category,
        review_status=review_status,
    )


@router.get(
    "/{project_id}/dependencies/subgraph/{node_id}",
    response_model=SubgraphResponse,
    summary="Get upstream and downstream subgraph for a single node via PostgreSQL recursive CTE",
)
async def get_node_subgraph(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    depth: int = Query(default=2, ge=1, le=10, description="Maximum traversal depth"),
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> SubgraphResponse:
    """Traverses upstream and downstream dependency edges using a PostgreSQL recursive CTE query."""
    graph_service = get_graph_service()
    return await graph_service.get_subgraph(
        db=db,
        project_id=project_id,
        node_id=node_id,
        depth=depth,
    )


@router.post(
    "/{project_id}/dependencies/sync-neo4j",
    status_code=status.HTTP_200_OK,
    summary="Mirror approved knowledge items and dependencies into Neo4j when enabled",
)
async def sync_to_neo4j(
    project_id: uuid.UUID,
    _membership: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Syncs approved knowledge items and relational edges to Neo4j if NEO4J_ENABLED is true."""
    sync_service = get_neo4j_sync_service()
    return await sync_service.sync_project_graph(db=db, project_id=project_id)
