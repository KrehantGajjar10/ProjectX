import logging
import uuid
from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Optional Neo4j client for knowledge graph queries and mirroring.

    Behind NEO4J_ENABLED feature flag (disabled by default).
    The application must function fully without Neo4j.
    NEVER writes to the relational database.
    """

    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
        enabled: bool | None = None,
    ) -> None:
        self.enabled = enabled if enabled is not None else settings.NEO4J_ENABLED
        self.uri = uri or settings.NEO4J_URI
        self.user = user or settings.NEO4J_USER
        self.password = password or settings.NEO4J_PASSWORD
        self._driver: AsyncDriver | None = None

    @property
    def driver(self) -> AsyncDriver:
        if not self.enabled:
            raise RuntimeError(
                "Neo4j integration is disabled by configuration (NEO4J_ENABLED=false)."
            )
        if self._driver is None:
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
            )
        return self._driver

    async def check_health(self) -> dict[str, Any]:
        """Checks Neo4j database connectivity and reporting status."""
        if not self.enabled:
            return {"enabled": False, "status": "disabled"}

        try:
            async with self.driver.session() as session:
                result = await session.run("RETURN 1 AS ping")
                record = await result.single()
                ping_val = record["ping"] if record else 1
                return {
                    "enabled": True,
                    "status": "healthy",
                    "uri": self.uri,
                    "ping": ping_val,
                }
        except Exception as exc:
            logger.warning("Neo4j health check failed: %s", exc)
            return {
                "enabled": True,
                "status": f"unhealthy: {exc}",
                "uri": self.uri,
            }

    async def sync_project_nodes_and_edges(
        self,
        project_id: uuid.UUID,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Mirrors approved knowledge items and dependencies into Neo4j graph nodes and relationships."""
        if not self.enabled:
            return {"synced": False, "reason": "Neo4j is disabled"}

        async with self.driver.session() as session:
            # 1. Project container node
            await session.run(
                "MERGE (p:Project {id: $project_id})",
                {"project_id": str(project_id)},
            )

            # 2. Batch upsert nodes
            if nodes:
                cypher_nodes = """
                UNWIND $nodes AS n
                MERGE (node:KnowledgeNode {id: n.id, project_id: $project_id})
                SET node.title = n.title,
                    node.category = n.category,
                    node.review_status = n.review_status,
                    node.confidence = n.confidence
                """
                await session.run(
                    cypher_nodes,
                    {"project_id": str(project_id), "nodes": nodes},
                )

            # 3. Batch upsert edges
            if edges:
                cypher_edges = """
                UNWIND $edges AS e
                MATCH (s:KnowledgeNode {id: e.source_id, project_id: $project_id})
                MATCH (t:KnowledgeNode {id: e.target_id, project_id: $project_id})
                MERGE (s)-[r:DEPENDS_ON {id: e.id}]->(t)
                SET r.type = e.type,
                    r.evidence_text = e.evidence_text
                """
                await session.run(
                    cypher_edges,
                    {"project_id": str(project_id), "edges": edges},
                )

        return {
            "synced": True,
            "nodes_count": len(nodes),
            "edges_count": len(edges),
        }

    async def query_subgraph(
        self,
        project_id: uuid.UUID,
        node_id: uuid.UUID,
        depth: int = 2,
    ) -> list[dict[str, Any]]:
        """Queries subgraph paths from Neo4j when enabled."""
        if not self.enabled:
            return []

        cypher = f"""
        MATCH path = (start:KnowledgeNode {{id: $node_id, project_id: $project_id}})-[*1..{depth}]-(other:KnowledgeNode {{project_id: $project_id}})
        RETURN path
        """
        async with self.driver.session() as session:
            result = await session.run(
                cypher,
                {"project_id": str(project_id), "node_id": str(node_id)},
            )
            records = await result.data()
            return records

    async def close(self) -> None:
        if self._driver:
            await self._driver.close()


_global_neo4j_client: Neo4jClient | None = None


def get_neo4j_client() -> Neo4jClient:
    global _global_neo4j_client
    if _global_neo4j_client is None:
        _global_neo4j_client = Neo4jClient()
    return _global_neo4j_client
