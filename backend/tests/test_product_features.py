import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.dependency import Dependency
from app.models.enums import (
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.knowledge import KnowledgeItem
from app.models.project import Project
from app.models.source import Source
from app.models.task import Task
from app.models.user import User


@pytest.mark.asyncio
async def test_dependency_graph_empty_project(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
):
    """Dependency graph for an empty project returns empty nodes and edges."""
    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/graph",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["nodes"] == []
    assert data["edges"] == []
    assert data["findings"] == []
    assert data["total_nodes"] == 0
    assert data["total_edges"] == 0


@pytest.mark.asyncio
async def test_dependency_graph_with_cycle_detection(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Dependency graph detects directed circular dependencies (A -> B -> C -> A)."""
    # 1. Create 3 KnowledgeItems
    item_a = KnowledgeItem(
        project_id=project_a.id,
        title="Microservice Architecture",
        description="Split monolith into services",
        category=KnowledgeCategory.DECISION,
        confidence=0.95,
        review_status=KnowledgeReviewStatus.APPROVED,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
    )
    item_b = KnowledgeItem(
        project_id=project_a.id,
        title="Shared Auth Service",
        description="Centralized JWT auth service",
        category=KnowledgeCategory.DECISION,
        confidence=0.90,
        review_status=KnowledgeReviewStatus.APPROVED,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
    )
    item_c = KnowledgeItem(
        project_id=project_a.id,
        title="API Gateway Proxy",
        description="Route requests and validate tokens",
        category=KnowledgeCategory.DECISION,
        confidence=0.92,
        review_status=KnowledgeReviewStatus.APPROVED,
        origin=KnowledgeOrigin.EXPLICIT_FACT,
    )
    db_session.add_all([item_a, item_b, item_c])
    await db_session.flush()

    # 2. Create cyclic dependencies: A -> B -> C -> A
    dep_ab = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=item_a.id,
        target_knowledge_item_id=item_b.id,
        type="depends_on",
        evidence_text="Microservices depend on shared auth",
    )
    dep_bc = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=item_b.id,
        target_knowledge_item_id=item_c.id,
        type="depends_on",
        evidence_text="Auth service routes via API gateway",
    )
    dep_ca = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=item_c.id,
        target_knowledge_item_id=item_a.id,
        type="depends_on",
        evidence_text="API Gateway depends on microservice architecture",
    )
    db_session.add_all([dep_ab, dep_bc, dep_ca])
    await db_session.commit()

    # 3. Query graph
    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/graph",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) == 3
    assert len(data["edges"]) == 3

    # Check circular dependency finding
    cycle_findings = [f for f in data["findings"] if f["type"] == "circular_dependency"]
    assert len(cycle_findings) >= 1
    cycle = cycle_findings[0]
    assert cycle["severity"] == "critical"
    involved = set(cycle["involved_node_ids"])
    assert str(item_a.id) in involved
    assert str(item_b.id) in involved
    assert str(item_c.id) in involved


@pytest.mark.asyncio
async def test_dependency_graph_blocked_chains_detection(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Dependency graph detects tasks or decisions blocked by incomplete items or rejected decisions."""
    # Create incomplete blocker task
    blocker_task = Task(
        project_id=project_a.id,
        title="Setup Cloud Infrastructure",
        status=TaskStatus.TODO,
        priority="high",
    )
    # Create dependent task
    dependent_task = Task(
        project_id=project_a.id,
        title="Deploy Application to Cloud",
        status=TaskStatus.TODO,
        priority="critical",
    )
    db_session.add_all([blocker_task, dependent_task])
    await db_session.flush()

    # Dependency: dependent_task depends_on blocker_task
    dep = Dependency(
        project_id=project_a.id,
        source_task_id=dependent_task.id,
        target_task_id=blocker_task.id,
        type="depends_on",
        evidence_text="Deployment requires provisioned infrastructure",
    )
    db_session.add(dep)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/graph",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()

    blocked_findings = [f for f in data["findings"] if f["type"] == "blocked_chain"]
    assert len(blocked_findings) >= 1
    finding = blocked_findings[0]
    assert finding["severity"] == "high"
    assert str(dependent_task.id) in finding["involved_node_ids"]
    assert str(blocker_task.id) in finding["involved_node_ids"]


@pytest.mark.asyncio
async def test_subgraph_traversal_recursive_cte(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Tests upstream and downstream traversal for a node using PostgreSQL recursive CTE."""
    # Chain: N1 -> N2 -> N3 -> N4
    n1 = KnowledgeItem(
        project_id=project_a.id,
        title="N1 Requirements",
        description="Core functional requirements for feature X",
        category=KnowledgeCategory.DECISION,
        confidence=0.9,
    )
    n2 = KnowledgeItem(
        project_id=project_a.id,
        title="N2 Design Spec",
        description="Architecture and technical design specification",
        category=KnowledgeCategory.DECISION,
        confidence=0.9,
    )
    n3 = KnowledgeItem(
        project_id=project_a.id,
        title="N3 Implementation",
        description="Implement APIs and backend components",
        category=KnowledgeCategory.TASK,
        confidence=0.9,
    )
    n4 = KnowledgeItem(
        project_id=project_a.id,
        title="N4 QA Verification",
        description="End-to-end testing and validation",
        category=KnowledgeCategory.TASK,
        confidence=0.9,
    )
    db_session.add_all([n1, n2, n3, n4])
    await db_session.flush()

    d1 = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=n1.id,
        target_knowledge_item_id=n2.id,
        type="depends_on",
    )
    d2 = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=n2.id,
        target_knowledge_item_id=n3.id,
        type="depends_on",
    )
    d3 = Dependency(
        project_id=project_a.id,
        source_knowledge_item_id=n3.id,
        target_knowledge_item_id=n4.id,
        type="depends_on",
    )
    db_session.add_all([d1, d2, d3])
    await db_session.commit()

    # Query subgraph for N2 with depth=1
    resp_depth1 = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/subgraph/{n2.id}?depth=1",
        headers=auth_headers_a,
    )
    assert resp_depth1.status_code == 200
    data1 = resp_depth1.json()
    assert data1["center_node_id"] == str(n2.id)
    node_ids1 = {n["id"] for n in data1["nodes"]}
    assert str(n2.id) in node_ids1
    assert str(n1.id) in node_ids1  # upstream
    assert str(n3.id) in node_ids1  # downstream
    assert str(n4.id) not in node_ids1  # depth 2 not reached

    # Query subgraph for N2 with depth=2
    resp_depth2 = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/subgraph/{n2.id}?depth=2",
        headers=auth_headers_a,
    )
    assert resp_depth2.status_code == 200
    data2 = resp_depth2.json()
    node_ids2 = {n["id"] for n in data2["nodes"]}
    assert str(n4.id) in node_ids2

    # Query non-existent node returns 404
    missing_id = uuid.uuid4()
    resp_404 = await client.get(
        f"/api/v1/projects/{project_a.id}/dependencies/subgraph/{missing_id}",
        headers=auth_headers_a,
    )
    assert resp_404.status_code == 404


@pytest.mark.asyncio
async def test_neo4j_feature_flag_behavior(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    monkeypatch,
):
    """Verifies that Neo4j is disabled by default and the system functions gracefully without it."""
    # 1. Check sync endpoint when disabled
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/dependencies/sync-neo4j",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is False
    assert "disabled" in data["message"].lower()

    # 2. Check health endpoint when Neo4j is disabled
    resp_health = await client.get("/api/v1/health")
    assert resp_health.status_code == 200
    health_data = resp_health.json()
    assert health_data["status"] == "healthy"
    assert health_data["neo4j"] == {"enabled": False, "status": "disabled"}

    # 3. Simulate Neo4j enabled with healthy connection
    from app.integrations.neo4j import get_neo4j_client

    client_instance = get_neo4j_client()

    async def mock_check_health():
        return {"enabled": True, "status": "healthy", "uri": "bolt://localhost:7687", "ping": 1}

    monkeypatch.setattr(client_instance, "check_health", mock_check_health)
    monkeypatch.setattr(settings, "NEO4J_ENABLED", True)

    resp_health_enabled = await client.get("/api/v1/health")
    assert resp_health_enabled.status_code == 200
    assert resp_health_enabled.json()["status"] == "healthy"
    assert resp_health_enabled.json()["neo4j"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_risk_detection_signals(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Verifies combining extracted risks with computed deterministic risk signals."""
    now = datetime.now(UTC)

    # 1. Extracted risk
    extracted_risk = KnowledgeItem(
        project_id=project_a.id,
        title="Critical Security Vulnerability in OpenSSL",
        description="Outdated OpenSSL version contains known remote exploit",
        category=KnowledgeCategory.RISK,
        confidence=0.95,
        review_status=KnowledgeReviewStatus.APPROVED,
    )
    db_session.add(extracted_risk)
    await db_session.flush()

    ev1 = Evidence(
        knowledge_item_id=extracted_risk.id,
        project_id=project_a.id,
        exact_excerpt="OpenSSL 1.1.1 is end of life and vulnerable to CVE-2023-0286",
        source_locator="Dockerfile:14",
        verified=True,
        confidence=0.98,
    )
    db_session.add(ev1)

    # 2. Overdue task
    overdue_task = Task(
        project_id=project_a.id,
        title="Renew SSL Certificates",
        status=TaskStatus.IN_PROGRESS,
        due_date=now - timedelta(days=5),
        priority="high",
    )
    db_session.add(overdue_task)

    # 3. Unassigned task
    unassigned_task = Task(
        project_id=project_a.id,
        title="Setup Automated Database Backups",
        status=TaskStatus.TODO,
        owner_id=None,
        priority="medium",
    )
    db_session.add(unassigned_task)

    # 4. Technical conflict item
    conflict_item = KnowledgeItem(
        project_id=project_a.id,
        title="Database Engine Selection",
        description="Conflicting decisions between MongoDB and PostgreSQL",
        category=KnowledgeCategory.DECISION,
        confidence=0.88,
        review_note="[CONFLICT_DETECTED] Opposing decision conclusions detected",
    )
    db_session.add(conflict_item)

    # 5. Unverified evidence item
    unverified_item = KnowledgeItem(
        project_id=project_a.id,
        title="Redis Caching Layer",
        description="Redis cluster handles session storage",
        category=KnowledgeCategory.DECISION,
        confidence=0.85,
    )
    db_session.add(unverified_item)
    await db_session.flush()

    ev2 = Evidence(
        knowledge_item_id=unverified_item.id,
        project_id=project_a.id,
        exact_excerpt="Redis cluster caching is enabled",
        source_locator="README.md:20",
        verified=False,  # Unverified
        confidence=0.50,
    )
    db_session.add(ev2)

    # 6. Single point of knowledge source (SPOK)
    spok_source = Source(
        project_id=project_a.id,
        name="Backend Core Repo",
        type="github",
        config={
            "commit_history": [
                {"author": "Alice", "message": "feat: init", "date": now.isoformat()},
                {"author": "Alice", "message": "fix: bug", "date": now.isoformat()},
                {"author": "Alice", "message": "refactor: api", "date": now.isoformat()},
            ]
        },
    )
    db_session.add(spok_source)
    await db_session.commit()

    # Query risks
    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/risks",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_risks"] >= 6
    assert "critical" in data["by_severity"]
    assert "high" in data["by_severity"]

    # Verify extracted risk
    extracted_found = [r for r in data["risks"] if r["source_type"] == "extracted"]
    assert len(extracted_found) >= 1
    assert extracted_found[0]["severity"] == "critical"

    # Verify computed signals
    computed_categories = {
        r["category"] for r in data["risks"] if r["source_type"] == "computed_signal"
    }
    assert "schedule" in computed_categories  # overdue task
    assert "ownership" in computed_categories  # unassigned task
    assert "conflict" in computed_categories  # technical conflict
    assert "unverified_evidence" in computed_categories  # unverified evidence
    assert "single_point_of_knowledge" in computed_categories  # SPOK

    # Test filtering by severity
    resp_filtered = await client.get(
        f"/api/v1/projects/{project_a.id}/risks?severity=critical",
        headers=auth_headers_a,
    )
    assert resp_filtered.status_code == 200
    for r in resp_filtered.json()["risks"]:
        assert r["severity"] == "critical"


@pytest.mark.asyncio
async def test_timeline_chronological_ordering(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Verifies chronological timeline merging milestones, decisions, tasks, and commits."""
    t0 = datetime(2026, 1, 1, 10, 0, 0, tzinfo=UTC)
    t1 = datetime(2026, 1, 2, 10, 0, 0, tzinfo=UTC)
    t2 = datetime(2026, 1, 3, 10, 0, 0, tzinfo=UTC)

    # Milestone at t0
    milestone = KnowledgeItem(
        project_id=project_a.id,
        title="Project Kickoff Milestone",
        description="Scope agreed and teams assigned",
        category=KnowledgeCategory.MILESTONE,
        confidence=0.99,
        created_at=t0,
    )
    # Decision at t1
    decision = KnowledgeItem(
        project_id=project_a.id,
        title="Selected FastAPI for Backend",
        description="Modern async Python framework",
        category=KnowledgeCategory.DECISION,
        confidence=0.98,
        created_at=t1,
    )
    # Task at t2
    task = Task(
        project_id=project_a.id,
        title="Configure Docker Compose",
        status=TaskStatus.TODO,
        priority="high",
        created_at=t2,
    )
    db_session.add_all([milestone, decision, task])
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/timeline",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_events"] >= 3

    # Assert reverse chronological order (newest first)
    timestamps = [e["timestamp"] for e in data["events"]]
    assert timestamps == sorted(timestamps, reverse=True)

    # Test filter by event_type=milestone
    resp_milestone = await client.get(
        f"/api/v1/projects/{project_a.id}/timeline?event_type=milestone",
        headers=auth_headers_a,
    )
    assert resp_milestone.status_code == 200
    for e in resp_milestone.json()["events"]:
        assert e["event_type"] == "milestone"


@pytest.mark.asyncio
async def test_task_tracking_and_audited_update(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    user_a: User,
    user_b: User,
    db_session: AsyncSession,
):
    """Tests task listing, audited PATCH updates, and progress summary computation."""
    task = Task(
        project_id=project_a.id,
        title="Write Alembic Migration",
        description="Generate migration for new tables",
        status=TaskStatus.TODO,
        priority="medium",
        owner_id=user_a.id,
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    # 1. Update task via PATCH
    update_payload = {
        "status": "completed",
        "priority": "critical",
        "owner_id": str(user_b.id),
    }
    patch_resp = await client.patch(
        f"/api/v1/projects/{project_a.id}/tasks/{task.id}",
        json=update_payload,
        headers=auth_headers_a,
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["status"] == "completed"
    assert updated_data["priority"] == "critical"
    assert updated_data["owner_id"] == str(user_b.id)
    # Description should contain audit trace
    assert f"by {user_a.id}" in updated_data["description"]
    assert "status: todo -> completed" in updated_data["description"]

    # 2. Get task progress summary
    prog_resp = await client.get(
        f"/api/v1/projects/{project_a.id}/tasks/progress",
        headers=auth_headers_a,
    )
    assert prog_resp.status_code == 200
    prog_data = prog_resp.json()
    assert prog_data["total_tasks"] == 1
    assert prog_data["completed_tasks"] == 1
    assert prog_data["completion_percentage"] == 100.0


@pytest.mark.asyncio
async def test_project_dashboard_summary(
    client: AsyncClient,
    auth_headers_a: dict[str, str],
    project_a: Project,
    db_session: AsyncSession,
):
    """Verifies that GET /projects/{id}/dashboard returns a complete unified dashboard in one call."""
    # Seed decision, task, and conflict
    decision = KnowledgeItem(
        project_id=project_a.id,
        title="Adopt Qdrant for Vector Search",
        description="High throughput vector database",
        category=KnowledgeCategory.DECISION,
        confidence=0.96,
        review_status=KnowledgeReviewStatus.APPROVED,
        review_note="[CONFLICT_DETECTED] Conflicted with earlier Faiss recommendation",
    )
    task = Task(
        project_id=project_a.id,
        title="Benchmark Qdrant Performance",
        status=TaskStatus.BLOCKED,
        priority="high",
    )
    db_session.add_all([decision, task])
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/projects/{project_a.id}/dashboard",
        headers=auth_headers_a,
    )
    assert resp.status_code == 200
    dash = resp.json()

    assert dash["project_id"] == str(project_a.id)
    assert dash["name"] == project_a.name
    assert dash["items_by_category"]["decision"] >= 1
    assert dash["conflicts_count"] >= 1
    assert dash["tasks_progress"]["blocked_tasks"] >= 1
    assert len(dash["highlights"]["blocked_tasks"]) >= 1
    assert len(dash["highlights"]["recent_decisions"]) >= 1
    assert "critical_risks" in dash["highlights"]
    assert "recent_activity" in dash
