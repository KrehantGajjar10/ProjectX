#!/usr/bin/env python3
"""ProjectX Demo Seed Script.

Sets up a demo user, demo project, synthetic sources, parsed chunks,
evidence-linked knowledge items, dependency graph, tasks, and an approved Handover Report.
Uses synthetic data only; no private data.
"""

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.dependency import Dependency
from app.models.document import Document, DocumentChunk
from app.models.enums import (
    HandoverReportStatus,
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    ProjectRole,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.handover import HandoverReport
from app.models.knowledge import KnowledgeItem
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.source import Source
from app.models.task import Task
from app.models.user import User

DEMO_USER_EMAIL = "demo@projectx.dev"
DEMO_USER_PASSWORD = "DemoUser123!"
DEMO_USER_NAME = "Dave Miller"

SAMPLE_README = """# Chronos Distributed Engine

Chronos is a high-throughput, fault-tolerant distributed workflow and event processing engine.

## Key Features
- Dynamic DAG workflow execution with async state transitions.
- High-performance event ingestion with PostgreSQL 17 JSONB storage.
- Dense semantic retrieval via Qdrant vector index.
- Evidence-linked audit trails for all critical business state changes.

## Quickstart
Run the engine via Docker Compose or native Python 3.12:
```bash
python -m chronos.worker
```
"""

SAMPLE_ARCH = """# Chronos Architecture & System Design

## Architecture Overview
Chronos is designed as a modular monolith with event-driven background job execution.

## Storage Decisions
We selected PostgreSQL 17 with asyncpg as the primary relational system of record.
Relational integrity and recursive queries are used to compute dependency DAGs.

## Search & Vector Indexing
Qdrant is configured as the dense semantic retrieval index.
All vectors are partitioned strictly by project_id in payloads to ensure complete tenant isolation.
"""

SAMPLE_NOTES = """# Chronos Architecture Review - Meeting Notes
Date: 2026-10-15
Attendees: Dave Miller (Tech Lead), Alice Chen (Senior Engineer), Bob Smith (Backend Engineer)

## Discussion Points & Decisions
1. Decision: Adopted token bucket sliding window for API rate limiting to prevent upstream exhaustion.
2. Task: Bob to implement token bucket rate limiter middleware in core module.
3. Task: Dave Miller to migrate legacy workflow compiler to AST parser before handoff.
4. Risk: Legacy workflow compiler is currently known only by Dave Miller, posing a critical single point of knowledge.
5. Milestone: Release v1.0 production baseline scheduled for end of quarter.
"""

SAMPLE_COMMITS = """commit a1b2c3d4e5f6g7h8
Author: Dave Miller <dave@projectx.dev>
Date:   2026-10-20 14:22:10 +0000
    compiler: core state machine in legacy_parser.py

commit 9z8y7x6w5v4u3t2s
Author: Dave Miller <dave@projectx.dev>
Date:   2026-10-22 09:15:30 +0000
    compiler: optimize bytecode generation in legacy_parser.py

commit f1e2d3c4b5a69870
Author: Alice Chen <alice@projectx.dev>
Date:   2026-10-25 11:45:00 +0000
    api: scaffold REST endpoints and authentication routes

commit 1122334455667788
Author: Bob Smith <bob@projectx.dev>
Date:   2026-10-28 16:30:12 +0000
    middleware: implement in-memory token bucket rate limiter
"""


async def seed_demo_data() -> None:
    print("=" * 60)
    print(" ProjectX: Seeding Synthetic Demo Data")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # 1. Create or retrieve demo user
        res = await db.execute(select(User).where(User.email == DEMO_USER_EMAIL))
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                email=DEMO_USER_EMAIL,
                hashed_password=get_password_hash(DEMO_USER_PASSWORD),
                full_name=DEMO_USER_NAME,
                is_active=True,
                is_superuser=False,
            )
            db.add(user)
            await db.flush()
            print(f"Created demo user: {DEMO_USER_EMAIL}")
        else:
            print(f"Demo user already exists: {DEMO_USER_EMAIL}")

        # 2. Create or retrieve demo project
        res = await db.execute(select(Project).where(Project.name == "Chronos Workflow Engine"))
        project = res.scalar_one_or_none()
        if not project:
            project = Project(
                name="Chronos Workflow Engine",
                description="High-throughput distributed workflow engine with event sourcing, evidence auditing, and DAG execution.",
                created_by_id=user.id,
            )
            db.add(project)
            await db.flush()

            # Add demo user as Owner
            member = ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role=ProjectRole.OWNER,
            )
            db.add(member)
            await db.flush()
            print(f"Created project: '{project.name}' (ID: {project.id})")
        else:
            print(f"Found existing project: '{project.name}' (ID: {project.id})")

        # 3. Create Demo Source
        res = await db.execute(
            select(Source).where(
                Source.project_id == project.id,
                Source.name == "Chronos Synthetic Core Docs",
            )
        )
        source = res.scalar_one_or_none()
        if not source:
            source = Source(
                project_id=project.id,
                name="Chronos Synthetic Core Docs",
                type="upload",
                config={"files_count": 4},
                created_by_id=user.id,
            )
            db.add(source)
            await db.flush()
            print(f"Created knowledge source: '{source.name}'")

        # 4. Create Documents & Chunks
        files_data = [
            ("README.md", SAMPLE_README, "markdown"),
            ("docs/ARCHITECTURE.md", SAMPLE_ARCH, "markdown"),
            ("docs/MEETING_NOTES.md", SAMPLE_NOTES, "markdown"),
            ("git/COMMITS.txt", SAMPLE_COMMITS, "code"),
        ]

        doc_map: dict[str, Document] = {}
        chunk_map: dict[str, DocumentChunk] = {}

        for file_path, content, doc_type in files_data:
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            res = await db.execute(
                select(Document).where(
                    Document.source_id == source.id,
                    Document.file_path == file_path,
                )
            )
            doc = res.scalar_one_or_none()
            if not doc:
                doc = Document(
                    project_id=project.id,
                    source_id=source.id,
                    file_path=file_path,
                    title=file_path.split("/")[-1],
                    content_hash=content_hash,
                    mime_type="text/markdown" if doc_type == "markdown" else "text/plain",
                    raw_content=content,
                    doc_metadata={"doc_type": doc_type, "file_size": len(content.encode("utf-8"))},
                    status="parsed",
                )
                db.add(doc)
                await db.flush()

                # Add single chunk for this doc
                chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=0,
                    content=content,
                    token_count=len(content.split()),
                    location_info={
                        "file_path": file_path,
                        "start_line": 1,
                        "end_line": len(content.splitlines()),
                    },
                )
                db.add(chunk)
                await db.flush()
                print(f"  Ingested document & chunk: {file_path}")
            else:
                res_c = await db.execute(
                    select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
                )
                chunk = res_c.scalar_one()

            doc_map[file_path] = doc
            chunk_map[file_path] = chunk

        # 5. Create Structured Knowledge Items with First-Class Evidence
        k_items_spec = [
            {
                "category": KnowledgeCategory.DECISION,
                "title": "PostgreSQL 17 for Relational Persistence and DAG Traversal",
                "description": "Selected PostgreSQL 17 with asyncpg for system of record and recursive CTEs for dependency resolution.",
                "file_path": "docs/ARCHITECTURE.md",
                "excerpt": "We selected PostgreSQL 17 with asyncpg as the primary relational system of record.",
                "confidence": 0.98,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
            {
                "category": KnowledgeCategory.DECISION,
                "title": "Tenant Partitioning via Project ID in Qdrant Vector Payloads",
                "description": "Dense semantic vectors are partitioned by project_id payload filtering to guarantee strict multi-tenant isolation.",
                "file_path": "docs/ARCHITECTURE.md",
                "excerpt": "All vectors are partitioned strictly by project_id in payloads to ensure complete tenant isolation.",
                "confidence": 0.96,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
            {
                "category": KnowledgeCategory.TASK,
                "title": "Implement Token Bucket Rate Limiter",
                "description": "Add rate limiter middleware to protect upstream LLM and ingestion endpoints from burst loads.",
                "file_path": "docs/MEETING_NOTES.md",
                "excerpt": "Task: Bob to implement token bucket rate limiter middleware in core module.",
                "confidence": 0.95,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
            {
                "category": KnowledgeCategory.TASK,
                "title": "Migrate Legacy Workflow Compiler to AST Parser",
                "description": "Refactor legacy regex compiler to an abstract syntax tree parser to eliminate syntax fragility.",
                "file_path": "docs/MEETING_NOTES.md",
                "excerpt": "Task: Dave Miller to migrate legacy workflow compiler to AST parser before handoff.",
                "confidence": 0.93,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
            {
                "category": KnowledgeCategory.RISK,
                "title": "Single Point of Knowledge in Legacy Workflow Compiler",
                "description": "Dave Miller is the sole contributor to legacy_parser.py, representing an acute single point of failure upon departure.",
                "file_path": "docs/MEETING_NOTES.md",
                "excerpt": "Risk: Legacy workflow compiler is currently known only by Dave Miller, posing a critical single point of knowledge.",
                "confidence": 0.99,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
            {
                "category": KnowledgeCategory.MILESTONE,
                "title": "Production Baseline Release v1.0",
                "description": "Target release milestone for verified workflow execution engine.",
                "file_path": "docs/MEETING_NOTES.md",
                "excerpt": "Milestone: Release v1.0 production baseline scheduled for end of quarter.",
                "confidence": 0.92,
                "origin": KnowledgeOrigin.EXPLICIT_FACT,
            },
        ]

        created_items: dict[str, KnowledgeItem] = {}
        for item_data in k_items_spec:
            res_k = await db.execute(
                select(KnowledgeItem).where(
                    KnowledgeItem.project_id == project.id,
                    KnowledgeItem.title == item_data["title"],
                )
            )
            k_item = res_k.scalar_one_or_none()
            if not k_item:
                k_item = KnowledgeItem(
                    project_id=project.id,
                    category=item_data["category"],
                    title=item_data["title"],
                    description=item_data["description"],
                    confidence=item_data["confidence"],
                    origin=item_data["origin"],
                    review_status=KnowledgeReviewStatus.APPROVED,
                    reviewer_id=user.id,
                    reviewed_at=datetime.now(UTC),
                )
                db.add(k_item)
                await db.flush()

                # Attach first-class Evidence
                doc = doc_map[item_data["file_path"]]
                chunk = chunk_map[item_data["file_path"]]
                evidence = Evidence(
                    project_id=project.id,
                    knowledge_item_id=k_item.id,
                    document_id=doc.id,
                    chunk_id=chunk.id,
                    source_locator=f"{item_data['file_path']}#chunk-0",
                    exact_excerpt=item_data["excerpt"],
                    confidence=item_data["confidence"],
                    verified=True,
                )
                db.add(evidence)
                await db.flush()
                print(
                    f"  Created verified knowledge item: [{item_data['category']}] {item_data['title']}"
                )

            created_items[item_data["title"]] = k_item

        # 6. Create Task Entities
        task_specs = [
            (
                "Implement Token Bucket Rate Limiter",
                "Rate limiter middleware implemented in app.core.rate_limit",
                TaskStatus.COMPLETED,
                "Bob Smith",
                datetime.now(UTC) - timedelta(days=2),
                created_items.get("Implement Token Bucket Rate Limiter"),
            ),
            (
                "Migrate Legacy Workflow Compiler to AST Parser",
                "Overdue task: Blocked by legacy parser technical debt. Needs transfer to Alice.",
                TaskStatus.BLOCKED,
                "Dave Miller",
                datetime.now(UTC) - timedelta(days=5),  # Overdue
                created_items.get("Migrate Legacy Workflow Compiler to AST Parser"),
            ),
            (
                "Write Frontend Integration Guide and OpenAPI Contract",
                "Complete openapi.json export and Krehant API integration documentation.",
                TaskStatus.IN_PROGRESS,
                "Alice Chen",
                datetime.now(UTC) + timedelta(days=3),
                None,
            ),
        ]

        created_tasks: dict[str, Task] = {}
        for title, desc, t_status, _owner_name, due, k_ref in task_specs:
            res_t = await db.execute(
                select(Task).where(Task.project_id == project.id, Task.title == title)
            )
            t_ent = res_t.scalar_one_or_none()
            if not t_ent:
                t_ent = Task(
                    project_id=project.id,
                    title=title,
                    description=desc,
                    status=t_status,
                    due_date=due,
                    owner_id=user.id,
                    priority="high" if t_status == TaskStatus.BLOCKED else "medium",
                    knowledge_item_id=k_ref.id if k_ref else None,
                )
                db.add(t_ent)
                await db.flush()
                print(f"  Created task: '{title}' [{t_status}]")
            created_tasks[title] = t_ent

        # 7. Create Dependencies
        blocked_task = created_tasks.get("Migrate Legacy Workflow Compiler to AST Parser")
        rate_limiter_task = created_tasks.get("Implement Token Bucket Rate Limiter")
        if blocked_task and rate_limiter_task:
            res_dep = await db.execute(
                select(Dependency).where(
                    Dependency.project_id == project.id,
                    Dependency.source_task_id == blocked_task.id,
                )
            )
            if not res_dep.scalar_one_or_none():
                dep = Dependency(
                    project_id=project.id,
                    source_task_id=blocked_task.id,
                    target_task_id=rate_limiter_task.id,
                    type="blocks",
                    evidence_text="Legacy compiler refactoring blocked by core rate limiting integration.",
                )
                db.add(dep)
                await db.flush()
                print("  Created dependency: AST Migration blocked by Rate Limiter")

        # 8. Create Handover Report (v1)
        res_h = await db.execute(
            select(HandoverReport).where(
                HandoverReport.project_id == project.id,
                HandoverReport.version == 1,
            )
        )
        report = res_h.scalar_one_or_none()
        if not report:
            k1 = created_items["PostgreSQL 17 for Relational Persistence and DAG Traversal"]
            k2 = created_items["Single Point of Knowledge in Legacy Workflow Compiler"]
            k3 = created_items["Migrate Legacy Workflow Compiler to AST Parser"]

            sections = {
                "project_overview": {
                    "key": "project_overview",
                    "title": "Project Overview & Current State",
                    "content": "Chronos Workflow Engine is a high-throughput distributed event engine built with FastAPI, PostgreSQL 17, and Qdrant. All core services are operational.",
                    "claims": [
                        {
                            "statement": "PostgreSQL 17 is the primary database for Chronos.",
                            "item_ids": [str(k1.id)],
                        }
                    ],
                    "evidence_references": [
                        {
                            "item_id": str(k1.id),
                            "title": k1.title,
                            "excerpt": "We selected PostgreSQL 17 with asyncpg as the primary relational system of record.",
                        }
                    ],
                },
                "completed_work": {
                    "key": "completed_work",
                    "title": "Completed Work & Milestone Delivery",
                    "content": "Token bucket rate limiting middleware has been merged and verified with high-concurrency benchmarks.",
                    "claims": [],
                    "evidence_references": [],
                },
                "pending_tasks": {
                    "key": "pending_tasks",
                    "title": "Pending, In-Progress & Blocked Tasks",
                    "content": "The legacy compiler AST migration is currently blocked and overdue, assigned to Dave Miller.",
                    "claims": [
                        {
                            "statement": "AST Migration task is blocked by legacy technical debt.",
                            "item_ids": [str(k3.id)],
                        }
                    ],
                    "evidence_references": [],
                },
                "key_decisions": {
                    "key": "key_decisions",
                    "title": "Key Architectural Decisions & Rationale",
                    "content": "Tenant isolation is enforced via project_id payload filtering in Qdrant collections.",
                    "claims": [
                        {
                            "statement": "Qdrant payload filtering isolates project tenant data.",
                            "item_ids": [str(k1.id)],
                        }
                    ],
                    "evidence_references": [],
                },
                "risks_and_mitigations": {
                    "key": "risks_and_mitigations",
                    "title": "Open Risks, Severity & Mitigation Strategies",
                    "content": "High severity risk: Dave Miller is the sole contributor to legacy_parser.py.",
                    "claims": [
                        {
                            "statement": "Dave Miller is the sole contributor to legacy_parser.py.",
                            "item_ids": [str(k2.id)],
                        }
                    ],
                    "evidence_references": [
                        {
                            "item_id": str(k2.id),
                            "title": k2.title,
                            "excerpt": "Risk: Legacy workflow compiler is currently known only by Dave Miller, posing a critical single point of knowledge.",
                        }
                    ],
                },
                "dependencies_critical_paths": {
                    "key": "dependencies_critical_paths",
                    "title": "Component Dependencies & Critical Paths",
                    "content": "AST migration depends on rate limiting integration and requires pair walkthrough before Dave Miller departs.",
                    "claims": [],
                    "evidence_references": [],
                },
                "knowledge_gaps_questions": {
                    "key": "knowledge_gaps_questions",
                    "title": "Open Questions & Knowledge Gaps",
                    "content": "Need comprehensive test fixtures for edge-case DAG cyclic loops.",
                    "claims": [],
                    "evidence_references": [],
                },
                "unresolved_conflicts": {
                    "key": "unresolved_conflicts",
                    "title": "Unresolved Conflicts & Design Trade-offs",
                    "content": "Evaluated synchronous vs worker-based ingestion, choosing worker architecture.",
                    "claims": [],
                    "evidence_references": [],
                },
                "actionable_continuation_plan": {
                    "key": "actionable_continuation_plan",
                    "title": "Actionable Continuation Plan",
                    "content": "1. Hand over legacy_parser.py to Alice Chen. 2. Unblock AST parser migration. 3. Finalize OpenAPI spec.",
                    "claims": [],
                    "evidence_references": [],
                },
                "departing_context_who_to_ask": {
                    "key": "departing_context_who_to_ask",
                    "title": "Who to Ask & Historical Context",
                    "content": "Dave Miller is the primary contact for legacy parser and storage architecture. Alice Chen will take over tech lead duties.",
                    "claims": [
                        {
                            "statement": "Dave Miller holds single point of knowledge for legacy compiler.",
                            "item_ids": [str(k2.id)],
                        }
                    ],
                    "evidence_references": [],
                },
            }

            report = HandoverReport(
                project_id=project.id,
                title="Chronos Workflow Engine - Lead Engineer Handover Report",
                version=1,
                status=HandoverReportStatus.APPROVED,
                departing_member_name=DEMO_USER_NAME,
                focus_area="Core Architecture & Legacy Compiler",
                approved_only=False,
                review_comment="Approved baseline handover report for Dave Miller's departure.",
                content_sections=sections,
                created_by_id=user.id,
                approved_by_id=user.id,
                approved_at=datetime.now(UTC),
            )
            db.add(report)
            await db.flush()
            print("  Created approved Handover Report v1")

        await db.commit()

    print("\n" + "=" * 60)
    print(" DEMO ENVIRONMENT READY!")
    print("=" * 60)
    print(" Login Email:     demo@projectx.dev")
    print(" Password:        DemoUser123!")
    print(f" Demo Project ID: {project.id}")
    print(" Endpoints to test:")
    print("   - POST /api/v1/auth/login")
    print(f"   - GET  /api/v1/projects/{project.id}/knowledge")
    print(f"   - GET  /api/v1/projects/{project.id}/dependencies/graph")
    print(f"   - GET  /api/v1/projects/{project.id}/risks")
    print(f"   - GET  /api/v1/projects/{project.id}/handover")
    print(f"   - GET  /api/v1/projects/{project.id}/handover/{report.id}/export/markdown")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
