import logging
import uuid
from collections import defaultdict

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.dependency import Dependency
from app.models.enums import KnowledgeCategory, KnowledgeReviewStatus, TaskStatus
from app.models.knowledge import KnowledgeItem
from app.models.task import Task
from app.schemas.graph import (
    DependencyGraphResponse,
    GraphEdge,
    GraphFinding,
    GraphNode,
    SubgraphResponse,
)

logger = logging.getLogger(__name__)


class GraphService:
    """Dependency mapping, cycle detection, blocked chains analysis,

    and PostgreSQL recursive CTE subgraph traversal.
    """

    async def get_project_graph(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        category: KnowledgeCategory | None = None,
        review_status: KnowledgeReviewStatus | None = None,
    ) -> DependencyGraphResponse:
        """Retrieves nodes and edges for the project's dependency graph,

        and runs deterministic finding algorithms (cycle detection, blocked chains).
        """
        # 1. Fetch KnowledgeItems
        kitem_query = (
            select(KnowledgeItem)
            .where(KnowledgeItem.project_id == project_id)
            .options(selectinload(KnowledgeItem.tasks))
        )
        if category:
            kitem_query = kitem_query.where(KnowledgeItem.category == category)
        if review_status:
            kitem_query = kitem_query.where(KnowledgeItem.review_status == review_status)

        res_kitems = await db.execute(kitem_query)
        kitems = res_kitems.scalars().all()

        # 2. Fetch Tasks
        task_query = select(Task).where(Task.project_id == project_id)
        res_tasks = await db.execute(task_query)
        tasks = res_tasks.scalars().all()

        # 3. Fetch Dependencies (Edges)
        dep_query = select(Dependency).where(Dependency.project_id == project_id)
        res_deps = await db.execute(dep_query)
        dependencies = res_deps.scalars().all()

        # Build Nodes dict: keyed by UUID
        nodes_map: dict[uuid.UUID, GraphNode] = {}
        for k in kitems:
            task_status = k.tasks[0].status.value if k.tasks else None
            nodes_map[k.id] = GraphNode(
                id=k.id,
                title=k.title,
                category=k.category.value,
                review_status=k.review_status.value,
                confidence=k.confidence,
                status=task_status,
                metadata_info={
                    "origin": k.origin.value,
                    "review_note": k.review_note,
                    "tasks_count": len(k.tasks),
                },
            )

        # Include standalone tasks or tasks without KnowledgeItem
        for t in tasks:
            if t.id not in nodes_map and (
                t.knowledge_item_id is None or t.knowledge_item_id not in nodes_map
            ):
                nodes_map[t.id] = GraphNode(
                    id=t.id,
                    title=t.title,
                    category="task",
                    review_status="approved" if t.status == TaskStatus.COMPLETED else "pending",
                    confidence=1.0,
                    status=t.status.value,
                    metadata_info={
                        "priority": t.priority,
                        "owner_id": str(t.owner_id) if t.owner_id else None,
                        "due_date": t.due_date.isoformat() if t.due_date else None,
                    },
                )

        # Build Edges list
        edges: list[GraphEdge] = []
        for d in dependencies:
            src_id = d.source_knowledge_item_id or d.source_task_id
            tgt_id = d.target_knowledge_item_id or d.target_task_id
            if src_id and tgt_id:
                edges.append(
                    GraphEdge(
                        id=d.id,
                        source_id=src_id,
                        target_id=tgt_id,
                        type=d.type,
                        evidence_text=d.evidence_text,
                        review_status="approved",
                    )
                )

        # Filter edges to only include ones where both source and target are in nodes_map
        valid_edges = [e for e in edges if e.source_id in nodes_map and e.target_id in nodes_map]

        # 4. Run Cycle Detection
        findings = self.detect_circular_dependencies(nodes_map, valid_edges)

        # 5. Run Blocked Chains Detection
        blocked_findings = self.detect_blocked_chains(nodes_map, valid_edges)
        findings.extend(blocked_findings)

        return DependencyGraphResponse(
            nodes=list(nodes_map.values()),
            edges=valid_edges,
            findings=findings,
            total_nodes=len(nodes_map),
            total_edges=len(valid_edges),
        )

    def detect_circular_dependencies(
        self,
        nodes_map: dict[uuid.UUID, GraphNode],
        edges: list[GraphEdge],
    ) -> list[GraphFinding]:
        """Detects directed cycles in the dependency graph using depth-first search."""
        adj: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        for e in edges:
            adj[e.source_id].append(e.target_id)

        visited: set[uuid.UUID] = set()
        rec_stack: list[uuid.UUID] = []
        cycle_sets: list[set[uuid.UUID]] = []
        findings: list[GraphFinding] = []

        def dfs(node_id: uuid.UUID) -> None:
            visited.add(node_id)
            rec_stack.append(node_id)

            for neighbor in adj[node_id]:
                if neighbor in rec_stack:
                    idx = rec_stack.index(neighbor)
                    cycle_nodes = rec_stack[idx:] + [neighbor]
                    cycle_set = set(cycle_nodes)
                    # Deduplicate cycles
                    if cycle_set not in cycle_sets:
                        cycle_sets.append(cycle_set)
                        titles = [nodes_map[nid].title for nid in cycle_nodes if nid in nodes_map]
                        findings.append(
                            GraphFinding(
                                type="circular_dependency",
                                severity="critical",
                                title="Circular Dependency Detected",
                                description=f"Circular dependency cycle: {' -> '.join(titles)}",
                                involved_node_ids=cycle_nodes,
                                details={"cycle_length": len(cycle_nodes) - 1},
                            )
                        )
                elif neighbor not in visited:
                    dfs(neighbor)

            rec_stack.pop()

        for nid in list(nodes_map.keys()):
            if nid not in visited:
                dfs(nid)

        return findings

    def detect_blocked_chains(
        self,
        nodes_map: dict[uuid.UUID, GraphNode],
        edges: list[GraphEdge],
    ) -> list[GraphFinding]:
        """Identifies items blocked by unfinished tasks or rejected decisions."""
        findings: list[GraphFinding] = []

        # Map edges: source depends on target or target blocks source
        for e in edges:
            src_node = nodes_map.get(e.source_id)
            tgt_node = nodes_map.get(e.target_id)
            if not src_node or not tgt_node:
                continue

            # Case A: e.type == "blocks" (tgt_node blocks src_node, or src_node blocks tgt_node)
            is_blocking = False
            blocker = None
            blocked = None

            if e.type == "blocks":
                blocker = src_node
                blocked = tgt_node
                is_blocking = True
            elif e.type in ("depends_on", "requires"):
                blocker = tgt_node
                blocked = src_node
                is_blocking = True

            if is_blocking and blocker and blocked:
                # Check if blocker is not finished
                is_unresolved = False
                reason = ""

                if blocker.status and blocker.status != TaskStatus.COMPLETED.value:
                    is_unresolved = True
                    reason = f"Blocker task '{blocker.title}' is in status '{blocker.status}' (incomplete)"
                elif blocker.review_status == KnowledgeReviewStatus.REJECTED.value:
                    is_unresolved = True
                    reason = f"Blocker item '{blocker.title}' was REJECTED during review"
                elif blocker.status == TaskStatus.BLOCKED.value:
                    is_unresolved = True
                    reason = f"Blocker task '{blocker.title}' is itself marked BLOCKED"

                if is_unresolved:
                    findings.append(
                        GraphFinding(
                            type="blocked_chain",
                            severity="high",
                            title=f"Blocked Item: {blocked.title}",
                            description=f"'{blocked.title}' is blocked: {reason}.",
                            involved_node_ids=[blocked.id, blocker.id],
                            details={
                                "blocked_id": str(blocked.id),
                                "blocker_id": str(blocker.id),
                                "edge_type": e.type,
                                "reason": reason,
                            },
                        )
                    )

        return findings

    async def get_subgraph(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        node_id: uuid.UUID,
        depth: int = 2,
    ) -> SubgraphResponse:
        """Traverses upstream and downstream dependency edges for a node up to depth N

        using a PostgreSQL recursive CTE query.
        """
        # 1. Verify center node exists
        center_q = select(KnowledgeItem).where(
            KnowledgeItem.project_id == project_id, KnowledgeItem.id == node_id
        )
        res_center = await db.execute(center_q)
        center_kitem = res_center.scalar_one_or_none()

        center_task = None
        if not center_kitem:
            res_t = await db.execute(
                select(Task).where(Task.project_id == project_id, Task.id == node_id)
            )
            center_task = res_t.scalar_one_or_none()
            if not center_task:
                raise NotFoundError(message=f"Node {node_id} not found in this project.")

        # 2. PostgreSQL Recursive CTE query for upstream and downstream traversal
        cte_sql = text("""
        WITH RECURSIVE upstream_cte AS (
            SELECT
                id,
                COALESCE(source_knowledge_item_id, source_task_id) AS source_id,
                COALESCE(target_knowledge_item_id, target_task_id) AS target_id,
                type,
                evidence_text,
                1 AS depth,
                'upstream' AS direction
            FROM dependencies
            WHERE project_id = CAST(:project_id AS uuid)
              AND (target_knowledge_item_id = CAST(:node_id AS uuid) OR target_task_id = CAST(:node_id AS uuid))

            UNION ALL

            SELECT
                d.id,
                COALESCE(d.source_knowledge_item_id, d.source_task_id) AS source_id,
                COALESCE(d.target_knowledge_item_id, d.target_task_id) AS target_id,
                d.type,
                d.evidence_text,
                u.depth + 1,
                'upstream' AS direction
            FROM dependencies d
            JOIN upstream_cte u ON (
                d.target_knowledge_item_id = u.source_id OR d.target_task_id = u.source_id
            )
            WHERE d.project_id = CAST(:project_id AS uuid) AND u.depth < :max_depth
        ),
        downstream_cte AS (
            SELECT
                id,
                COALESCE(source_knowledge_item_id, source_task_id) AS source_id,
                COALESCE(target_knowledge_item_id, target_task_id) AS target_id,
                type,
                evidence_text,
                1 AS depth,
                'downstream' AS direction
            FROM dependencies
            WHERE project_id = CAST(:project_id AS uuid)
              AND (source_knowledge_item_id = CAST(:node_id AS uuid) OR source_task_id = CAST(:node_id AS uuid))

            UNION ALL

            SELECT
                d.id,
                COALESCE(d.source_knowledge_item_id, d.source_task_id) AS source_id,
                COALESCE(d.target_knowledge_item_id, d.target_task_id) AS target_id,
                d.type,
                d.evidence_text,
                dw.depth + 1,
                'downstream' AS direction
            FROM dependencies d
            JOIN downstream_cte dw ON (
                d.source_knowledge_item_id = dw.target_id OR d.source_task_id = dw.target_id
            )
            WHERE d.project_id = CAST(:project_id AS uuid) AND dw.depth < :max_depth
        )
        SELECT * FROM upstream_cte
        UNION
        SELECT * FROM downstream_cte
        """)

        res_cte = await db.execute(
            cte_sql,
            {"project_id": project_id, "node_id": node_id, "max_depth": depth},
        )
        edge_rows = res_cte.mappings().all()

        involved_node_ids = {node_id}
        subgraph_edges: list[GraphEdge] = []
        upstream_count = 0
        downstream_count = 0

        for r in edge_rows:
            src = r["source_id"]
            tgt = r["target_id"]
            if src and tgt:
                involved_node_ids.add(src)
                involved_node_ids.add(tgt)
                subgraph_edges.append(
                    GraphEdge(
                        id=r["id"],
                        source_id=src,
                        target_id=tgt,
                        type=r["type"],
                        evidence_text=r["evidence_text"],
                        review_status="approved",
                    )
                )
                if r["direction"] == "upstream":
                    upstream_count += 1
                else:
                    downstream_count += 1

        # Hydrate nodes
        k_res = await db.execute(
            select(KnowledgeItem)
            .options(selectinload(KnowledgeItem.tasks))
            .where(KnowledgeItem.project_id == project_id, KnowledgeItem.id.in_(involved_node_ids))
        )
        sub_kitems = k_res.scalars().all()

        t_res = await db.execute(
            select(Task).where(Task.project_id == project_id, Task.id.in_(involved_node_ids))
        )
        sub_tasks = t_res.scalars().all()

        subgraph_nodes: dict[uuid.UUID, GraphNode] = {}
        for k in sub_kitems:
            task_status = k.tasks[0].status.value if k.tasks else None
            subgraph_nodes[k.id] = GraphNode(
                id=k.id,
                title=k.title,
                category=k.category.value,
                review_status=k.review_status.value,
                confidence=k.confidence,
                status=task_status,
                metadata_info={"origin": k.origin.value},
            )

        for t in sub_tasks:
            if t.id not in subgraph_nodes:
                subgraph_nodes[t.id] = GraphNode(
                    id=t.id,
                    title=t.title,
                    category="task",
                    review_status="approved" if t.status == TaskStatus.COMPLETED else "pending",
                    confidence=1.0,
                    status=t.status.value,
                    metadata_info={"priority": t.priority},
                )

        return SubgraphResponse(
            center_node_id=node_id,
            depth=depth,
            nodes=list(subgraph_nodes.values()),
            edges=subgraph_edges,
            upstream_count=upstream_count,
            downstream_count=downstream_count,
        )


_global_graph_service: GraphService | None = None


def get_graph_service() -> GraphService:
    global _global_graph_service
    if _global_graph_service is None:
        _global_graph_service = GraphService()
    return _global_graph_service
