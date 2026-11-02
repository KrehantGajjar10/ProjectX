import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.neo4j import Neo4jClient, get_neo4j_client
from app.models.dependency import Dependency
from app.models.enums import KnowledgeReviewStatus
from app.models.knowledge import KnowledgeItem

logger = logging.getLogger(__name__)


class Neo4jSyncService:
    """Mirrors approved project knowledge items and dependencies into Neo4j graph when enabled."""

    def __init__(self, neo4j_client: Neo4jClient | None = None) -> None:
        self.neo4j = neo4j_client or get_neo4j_client()

    async def sync_project_graph(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Mirrors approved knowledge items and dependencies into Neo4j."""
        if not settings.NEO4J_ENABLED or not self.neo4j.enabled:
            return {
                "enabled": False,
                "synced_nodes": 0,
                "synced_edges": 0,
                "message": "Neo4j integration is disabled by configuration.",
            }

        # 1. Fetch approved KnowledgeItems
        k_q = select(KnowledgeItem).where(
            KnowledgeItem.project_id == project_id,
            KnowledgeItem.review_status == KnowledgeReviewStatus.APPROVED,
        )
        res_k = await db.execute(k_q)
        approved_items = res_k.scalars().all()
        approved_ids = {k.id for k in approved_items}

        nodes = [
            {
                "id": str(k.id),
                "title": k.title,
                "category": k.category.value,
                "review_status": k.review_status.value,
                "confidence": k.confidence,
            }
            for k in approved_items
        ]

        # 2. Fetch Dependencies connecting approved items
        dep_q = select(Dependency).where(Dependency.project_id == project_id)
        res_dep = await db.execute(dep_q)
        dependencies = res_dep.scalars().all()

        edges = []
        for d in dependencies:
            src = d.source_knowledge_item_id or d.source_task_id
            tgt = d.target_knowledge_item_id or d.target_task_id
            if src and tgt and src in approved_ids and tgt in approved_ids:
                edges.append(
                    {
                        "id": str(d.id),
                        "source_id": str(src),
                        "target_id": str(tgt),
                        "type": d.type,
                        "evidence_text": d.evidence_text or "",
                    }
                )

        # 3. Push to Neo4j
        sync_res = await self.neo4j.sync_project_nodes_and_edges(
            project_id=project_id,
            nodes=nodes,
            edges=edges,
        )
        return {
            "enabled": True,
            "synced_nodes": len(nodes),
            "synced_edges": len(edges),
            "details": sync_res,
        }


_global_neo4j_sync_service: Neo4jSyncService | None = None


def get_neo4j_sync_service() -> Neo4jSyncService:
    global _global_neo4j_sync_service
    if _global_neo4j_sync_service is None:
        _global_neo4j_sync_service = Neo4jSyncService()
    return _global_neo4j_sync_service
