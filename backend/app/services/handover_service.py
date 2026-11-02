import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.db.session import AsyncSessionLocal
from app.integrations.gemini import get_gemini_client
from app.models.document import Document
from app.models.enums import (
    HandoverReportStatus,
    IngestionJobStatus,
    KnowledgeCategory,
    KnowledgeReviewStatus,
    TaskStatus,
)
from app.models.handover import HandoverReport
from app.models.ingestion import IngestionJob
from app.models.knowledge import KnowledgeItem
from app.models.project import Project
from app.models.source import Source
from app.models.task import Task
from app.schemas.handover import (
    EvidenceReference,
    HandoverDiffResponse,
    HandoverDiffSection,
    HandoverGenerateRequest,
    HandoverGenerationJobStatus,
    HandoverReportDetailRead,
    HandoverReportVersionSummary,
    HandoverSection,
    LatestHandoverResponse,
)
from app.services.audit_service import get_audit_service
from app.services.graph_service import get_graph_service
from app.services.handover_validator import get_handover_validator
from app.services.risk_service import get_risk_service

logger = logging.getLogger(__name__)


class HandoverService:
    """Orchestrates evidence-first project handover generation, validation, versioning, review, and diffing."""

    def __init__(self, session_factory=None) -> None:
        self.session_factory = session_factory or AsyncSessionLocal
        self.gemini = get_gemini_client()
        self.validator = get_handover_validator()
        self.risk_service = get_risk_service()
        self.graph_service = get_graph_service()
        self.audit_service = get_audit_service()

    async def start_handover_generation(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        request_in: HandoverGenerateRequest,
        background_tasks: BackgroundTasks | None = None,
    ) -> IngestionJob:
        """Starts a background handover generation job, creating a trackable job record."""
        # 1. Verify project exists
        p_res = await db.execute(select(Project).where(Project.id == project_id))
        project = p_res.scalar_one_or_none()
        if not project:
            raise NotFoundError(message=f"Project {project_id} not found.")

        # 2. Create IngestionJob record to track progress
        job = IngestionJob(
            project_id=project_id,
            status=IngestionJobStatus.QUEUED,
            progress=0,
            metadata_info={
                "job_type": "handover_generation",
                "request": request_in.model_dump(),
                "created_by_id": str(user_id),
            },
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        # 3. Trigger async generation task
        if background_tasks:
            background_tasks.add_task(
                self._run_generation_in_background,
                project_id=project_id,
                user_id=user_id,
                request_in=request_in,
                job_id=job.id,
            )
        else:
            asyncio.create_task(
                self._run_generation_in_background(
                    project_id=project_id,
                    user_id=user_id,
                    request_in=request_in,
                    job_id=job.id,
                )
            )

        return job

    async def _run_generation_in_background(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        request_in: HandoverGenerateRequest,
        job_id: uuid.UUID,
    ) -> None:
        """Background execution wrapper opening an isolated DB session."""
        async with self.session_factory() as session:
            try:
                # Update job to processing
                j_res = await session.execute(select(IngestionJob).where(IngestionJob.id == job_id))
                job = j_res.scalar_one_or_none()
                if job:
                    job.status = IngestionJobStatus.PROCESSING
                    job.started_at = datetime.now(UTC)
                    job.progress = 10
                    await session.commit()

                # Run generation
                await self.generate_handover_report(
                    db=session,
                    project_id=project_id,
                    user_id=user_id,
                    request_in=request_in,
                    job_id=job_id,
                )
            except Exception as exc:
                logger.exception("Handover generation job %s failed: %s", job_id, exc)
                j_res = await session.execute(select(IngestionJob).where(IngestionJob.id == job_id))
                job = j_res.scalar_one_or_none()
                if job:
                    job.status = IngestionJobStatus.FAILED
                    job.error = str(exc)
                    job.completed_at = datetime.now(UTC)
                    await session.commit()

    async def generate_handover_report(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        request_in: HandoverGenerateRequest,
        job_id: uuid.UUID | None = None,
    ) -> HandoverReportDetailRead:
        """Collects structured knowledge, synthesizes narrative, validates evidence claims,

        increments version, and persists HandoverReport.
        """
        # 1. Fetch project
        p_res = await db.execute(select(Project).where(Project.id == project_id))
        project = p_res.scalar_one_or_none()
        if not project:
            raise NotFoundError(message=f"Project {project_id} not found.")

        # 2. Gather Knowledge Items with Evidences
        k_query = (
            select(KnowledgeItem)
            .where(KnowledgeItem.project_id == project_id)
            .options(
                selectinload(KnowledgeItem.evidences),
                selectinload(KnowledgeItem.tasks),
            )
        )
        if request_in.approved_only:
            k_query = k_query.where(KnowledgeItem.review_status == KnowledgeReviewStatus.APPROVED)
        else:
            # Approved first, then pending
            k_query = k_query.order_by(
                KnowledgeItem.review_status.asc(),
                KnowledgeItem.confidence.desc(),
            )

        res_k = await db.execute(k_query)
        knowledge_items = res_k.scalars().all()

        # 3. Gather Tasks
        t_query = (
            select(Task)
            .where(Task.project_id == project_id)
            .options(
                selectinload(Task.knowledge_item).selectinload(KnowledgeItem.evidences),
                selectinload(Task.owner),
            )
            .order_by(Task.due_date.asc().nulls_last())
        )
        res_t = await db.execute(t_query)
        tasks = res_t.scalars().all()

        # 4. Gather Graph Analysis & Findings
        graph_data = await self.graph_service.get_project_graph(db=db, project_id=project_id)

        # 5. Gather Risk Summary & Computed Signals
        risk_summary = await self.risk_service.get_project_risks(db=db, project_id=project_id)

        # 6. Gather Sources & Commits & Documents
        s_query = select(Source).where(Source.project_id == project_id)
        res_s = await db.execute(s_query)
        sources = res_s.scalars().all()

        d_query = select(Document.id, Document.title).where(Document.project_id == project_id)
        res_d = await db.execute(d_query)
        doc_titles = dict(res_d.all())

        # Update job progress (35%)
        if job_id:
            await self._update_job_progress(db, job_id, 35)

        # 7. Build grounding items map
        grounding_items_map: dict[uuid.UUID, dict[str, Any]] = {}

        # Register KnowledgeItems
        for k in knowledge_items:
            ev_refs = [
                EvidenceReference(
                    evidence_id=e.id,
                    knowledge_item_id=k.id,
                    knowledge_item_title=k.title,
                    document_name=doc_titles.get(e.document_id)
                    or (e.source_locator.split(":")[0] if e.source_locator else "Document"),
                    source_locator=e.source_locator,
                    exact_excerpt=e.exact_excerpt,
                    verified=e.verified,
                    review_status=k.review_status.value,
                    origin=k.origin.value,
                    confidence=e.confidence or k.confidence,
                )
                for e in k.evidences
            ]
            grounding_items_map[k.id] = {
                "id": k.id,
                "title": k.title,
                "description": k.description,
                "category": k.category.value,
                "review_status": k.review_status.value,
                "origin": k.origin.value,
                "confidence": k.confidence,
                "review_note": k.review_note,
                "evidences": ev_refs,
            }

        # Register Tasks as groundable items
        for t in tasks:
            task_evs: list[EvidenceReference] = []
            if t.knowledge_item and t.knowledge_item.evidences:
                task_evs = [
                    EvidenceReference(
                        evidence_id=e.id,
                        knowledge_item_id=t.knowledge_item.id,
                        knowledge_item_title=t.knowledge_item.title,
                        document_name=doc_titles.get(e.document_id)
                        or (e.source_locator.split(":")[0] if e.source_locator else "Document"),
                        source_locator=e.source_locator,
                        exact_excerpt=e.exact_excerpt,
                        verified=e.verified,
                        review_status="approved" if t.status == TaskStatus.COMPLETED else "pending",
                        origin="explicit_fact",
                        confidence=1.0,
                    )
                    for e in t.knowledge_item.evidences
                ]
            grounding_items_map[t.id] = {
                "id": t.id,
                "title": t.title,
                "description": t.description or "",
                "category": "task",
                "review_status": "approved" if t.status == TaskStatus.COMPLETED else "pending",
                "origin": "explicit_fact",
                "confidence": 1.0,
                "status": t.status.value,
                "priority": t.priority,
                "owner": t.owner.full_name if t.owner else None,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "evidences": task_evs,
            }

        # 8. Structure payload for LLM prompt
        departing_name_lower = (request_in.departing_member_name or "").lower()
        sole_author_sources = []
        departing_tasks = []

        for s in sources:
            commits = s.config.get("commit_history", []) if s.config else []
            authors = {c.get("author", "").lower() for c in commits if c.get("author")}
            if departing_name_lower and any(departing_name_lower in a for a in authors):
                sole_author_sources.append(
                    {"source_name": s.name, "authors": list(authors), "commits_count": len(commits)}
                )
            elif len(authors) == 1:
                sole_author_sources.append(
                    {
                        "source_name": s.name,
                        "sole_author": list(authors)[0],
                        "commits_count": len(commits),
                    }
                )

        for t in tasks:
            if (
                t.owner
                and departing_name_lower
                and departing_name_lower in t.owner.full_name.lower()
            ):
                departing_tasks.append(str(t.id))

        structured_context = {
            "project_name": project.name,
            "project_description": project.description,
            "knowledge_items": [
                {
                    "id": str(k.id),
                    "title": k.title,
                    "description": k.description,
                    "category": k.category.value,
                    "review_status": k.review_status.value,
                    "origin": k.origin.value,
                    "confidence": k.confidence,
                    "review_note": k.review_note,
                }
                for k in knowledge_items
            ],
            "tasks": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status.value,
                    "priority": t.priority,
                    "owner": t.owner.full_name if t.owner else None,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                }
                for t in tasks
            ],
            "risks": [
                {
                    "id": r.id,
                    "title": r.title,
                    "severity": r.severity,
                    "category": r.category,
                    "rationale": r.rationale,
                    "source_type": r.source_type,
                }
                for r in risk_summary.risks
            ],
            "dependencies_and_findings": [
                {
                    "type": f.type,
                    "severity": f.severity,
                    "title": f.title,
                    "description": f.description,
                    "involved_node_ids": [str(nid) for nid in f.involved_node_ids],
                }
                for f in graph_data.findings
            ],
            "departing_member_context": {
                "name": request_in.departing_member_name,
                "associated_tasks": departing_tasks,
                "associated_sources": sole_author_sources,
            },
        }

        # Update job progress (60%)
        if job_id:
            await self._update_job_progress(db, job_id, 60)

        # 9. Call Gemini (or synthesize grounded narrative fallback)
        raw_sections = {}
        try:
            raw_sections = await self.gemini.generate_handover_narrative(
                project_name=project.name,
                project_description=project.description,
                departing_member_name=request_in.departing_member_name,
                focus_area=request_in.focus_area,
                approved_only=request_in.approved_only,
                structured_data_json=json.dumps(structured_context, indent=2),
            )
        except Exception as e:
            logger.warning(
                "Gemini narrative generation call failed or unconfigured, using deterministic synthesis: %s",
                e,
            )

        # Fallback / deterministic synthesis if LLM response incomplete or empty
        if not raw_sections or not isinstance(raw_sections, dict):
            raw_sections = self._synthesize_grounded_fallback_sections(
                project=project,
                knowledge_items=knowledge_items,
                tasks=tasks,
                risk_summary=risk_summary,
                graph_data=graph_data,
                request_in=request_in,
                sole_author_sources=sole_author_sources,
            )

        # Update job progress (80%)
        if job_id:
            await self._update_job_progress(db, job_id, 80)

        # 10. Validate claims against real database items and evidence
        (
            validated_sections,
            all_evidence_refs,
            total_claims,
            verified_claims,
            unverified_claims,
        ) = self.validator.validate_sections(
            raw_sections=raw_sections,
            grounding_items_map=grounding_items_map,
            drop_unverified=False,
        )

        # 11. Calculate next version number
        v_q = select(func.coalesce(func.max(HandoverReport.version), 0)).where(
            HandoverReport.project_id == project_id
        )
        res_v = await db.execute(v_q)
        max_v = res_v.scalar_one()
        next_version = max_v + 1

        # 12. Persist HandoverReport in database
        serialized_sections = {
            k: sec.model_dump(mode="json") for k, sec in validated_sections.items()
        }

        report = HandoverReport(
            project_id=project_id,
            title=f"{project.name} Handover Report",
            version=next_version,
            status=HandoverReportStatus.DRAFT,
            departing_member_name=request_in.departing_member_name,
            focus_area=request_in.focus_area,
            approved_only=request_in.approved_only,
            content_sections=serialized_sections,
            created_by_id=user_id,
        )
        db.add(report)
        await db.flush()

        # 13. Update IngestionJob to COMPLETED
        if job_id:
            j_q = select(IngestionJob).where(IngestionJob.id == job_id)
            j_res = await db.execute(j_q)
            job = j_res.scalar_one_or_none()
            if job:
                job.status = IngestionJobStatus.COMPLETED
                job.progress = 100
                job.completed_at = datetime.now(UTC)
                meta = dict(job.metadata_info or {})
                meta["report_id"] = str(report.id)
                meta["version"] = report.version
                job.metadata_info = meta

        # 14. Record Audit Log
        await self.audit_service.record_audit_event(
            db=db,
            project_id=project_id,
            actor_id=user_id,
            action="handover_generate",
            entity_type="handover_report",
            entity_id=report.id,
            details={
                "version": report.version,
                "departing_member": request_in.departing_member_name,
                "focus_area": request_in.focus_area,
                "total_claims": total_claims,
                "verified_claims": verified_claims,
            },
        )

        await db.commit()
        await db.refresh(report)

        return self._build_detail_read(
            report,
            validated_sections,
            all_evidence_refs,
            total_claims,
            verified_claims,
            unverified_claims,
        )

    async def _update_job_progress(
        self, db: AsyncSession, job_id: uuid.UUID, progress: int
    ) -> None:
        j_q = select(IngestionJob).where(IngestionJob.id == job_id)
        res = await db.execute(j_q)
        job = res.scalar_one_or_none()
        if job:
            job.progress = progress
            job.heartbeat_at = datetime.now(UTC)
            await db.commit()

    def _synthesize_grounded_fallback_sections(
        self,
        project: Project,
        knowledge_items: list[KnowledgeItem],
        tasks: list[Task],
        risk_summary: Any,
        graph_data: Any,
        request_in: HandoverGenerateRequest,
        sole_author_sources: list[dict],
    ) -> dict[str, Any]:
        """Synthesizes high-fidelity, 100% grounded sections directly from verified structured data."""
        decisions = [k for k in knowledge_items if k.category == KnowledgeCategory.DECISION]
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
        pending_tasks = [t for t in tasks if t.status in (TaskStatus.TODO, TaskStatus.IN_PROGRESS)]
        blocked_tasks = [t for t in tasks if t.status == TaskStatus.BLOCKED]

        conflicts = [k for k in knowledge_items if "[CONFLICT_DETECTED]" in (k.review_note or "")]
        gaps = [
            k
            for k in knowledge_items
            if "GAP:" in (k.review_note or "") or "[UNVERIFIED_EVIDENCE]" in (k.review_note or "")
        ]

        return {
            "project_overview": {
                "title": "Project Overview and Current State",
                "narrative": f"{project.name} knowledge handover. Current repository contains {len(knowledge_items)} knowledge items and {len(tasks)} tracked tasks.",
                "statements": [
                    {
                        "text": f"Project '{project.name}': {project.description or 'Core repository system'}",
                        "item_ids": [str(k.id) for k in decisions[:2]],
                    }
                ]
                if decisions
                else [],
            },
            "completed_work": {
                "title": "Completed Work",
                "narrative": f"A total of {len(completed_tasks)} tasks have been completed and verified.",
                "statements": [
                    {"text": f"Completed: {t.title}", "item_ids": [str(t.id)]}
                    for t in completed_tasks
                ],
            },
            "pending_and_blocked_tasks": {
                "title": "Pending and Blocked Tasks with Owners",
                "narrative": f"There are {len(pending_tasks)} pending tasks and {len(blocked_tasks)} blocked tasks requiring immediate resolution.",
                "statements": [
                    {
                        "text": f"Blocked: {t.title} (Priority: {t.priority}, Owner: {t.owner.full_name if t.owner else 'Unassigned'})",
                        "item_ids": [str(t.id)],
                    }
                    for t in blocked_tasks
                ]
                + [
                    {
                        "text": f"Pending: {t.title} (Priority: {t.priority}, Owner: {t.owner.full_name if t.owner else 'Unassigned'})",
                        "item_ids": [str(t.id)],
                    }
                    for t in pending_tasks[:8]
                ],
            },
            "key_decisions": {
                "title": "Key Decisions with Rationale",
                "narrative": f"The architectural direction is governed by {len(decisions)} key technical decisions.",
                "statements": [
                    {
                        "text": f"{d.title}: {d.description} (Status: {d.review_status.value})",
                        "item_ids": [str(d.id)],
                    }
                    for d in decisions
                ],
            },
            "open_risks": {
                "title": "Open Risks with Severity",
                "narrative": f"Risk audit identified {risk_summary.total_risks} open risks across the codebase.",
                "statements": [
                    {
                        "text": f"[{r.severity.upper()}] {r.title}: {r.description}",
                        "item_ids": [str(r.entity_id)] if r.entity_id else [],
                    }
                    for r in risk_summary.risks
                ],
            },
            "dependencies": {
                "title": "Dependencies and Critical Paths",
                "narrative": f"System graph models {graph_data.total_nodes} nodes and {graph_data.total_edges} dependency edges.",
                "statements": [
                    {
                        "text": f"[{f.severity.upper()}] {f.title}: {f.description}",
                        "item_ids": [str(nid) for nid in f.involved_node_ids],
                    }
                    for f in graph_data.findings
                ],
            },
            "knowledge_gaps": {
                "title": "Open Questions and Knowledge Gaps",
                "narrative": f"Flagged {len(gaps)} knowledge gaps requiring clarification from stakeholders.",
                "statements": [
                    {
                        "text": f"Knowledge Gap: {g.title} ({g.review_note or 'Requires validation'})",
                        "item_ids": [str(g.id)],
                    }
                    for g in gaps
                ],
            },
            "conflicts": {
                "title": "Conflicts Needing Resolution",
                "narrative": f"Found {len(conflicts)} architectural contradictions requiring team alignment.",
                "statements": [
                    {
                        "text": f"Conflict Detected: {c.title} — {c.review_note}",
                        "item_ids": [str(c.id)],
                    }
                    for c in conflicts
                ],
            },
            "continuation_plan": {
                "title": "Recommended Continuation Plan (Prioritized Next Steps)",
                "narrative": "Immediate roadmap for incoming team to ensure seamless project transition.",
                "statements": [
                    {
                        "text": f"Priority 1: Unblock '{t.title}'",
                        "item_ids": [str(t.id)],
                    }
                    for t in blocked_tasks[:3]
                ]
                + [
                    {
                        "text": f"Priority 2: Address critical risk '{r.title}'",
                        "item_ids": [str(r.entity_id)] if r.entity_id else [],
                    }
                    for r in risk_summary.risks
                    if r.severity == "critical"
                ],
            },
            "departing_member_knowledge": {
                "title": "Who to Ask and Departing Person Sole Knowledge",
                "narrative": f"Knowledge continuity analysis for departing contributor: {request_in.departing_member_name or 'Key Contributor'}.",
                "statements": [
                    {
                        "text": f"Single Point of Knowledge detected in source '{s.get('source_name')}': dominated by {s.get('sole_author', request_in.departing_member_name)} ({s.get('commits_count')} commits)",
                        "item_ids": [],
                    }
                    for s in sole_author_sources
                ],
            },
        }

    async def get_latest_handover(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> LatestHandoverResponse:
        """Returns the latest report (if any) and active generation job status."""
        # 1. Fetch latest report
        r_q = (
            select(HandoverReport)
            .where(HandoverReport.project_id == project_id)
            .order_by(desc(HandoverReport.version), desc(HandoverReport.created_at))
            .limit(1)
        )
        res_r = await db.execute(r_q)
        latest_report = res_r.scalar_one_or_none()

        detail_read: HandoverReportDetailRead | None = None
        if latest_report:
            detail_read = self._hydrate_report_from_db(latest_report)

        # 2. Check for active generation job
        job_q = (
            select(IngestionJob)
            .where(
                IngestionJob.project_id == project_id,
                IngestionJob.status.in_([IngestionJobStatus.QUEUED, IngestionJobStatus.PROCESSING]),
            )
            .order_by(desc(IngestionJob.created_at))
            .limit(1)
        )
        res_job = await db.execute(job_q)
        active_job = res_job.scalar_one_or_none()

        job_status: HandoverGenerationJobStatus | None = None
        if active_job and active_job.metadata_info.get("job_type") == "handover_generation":
            rep_id_raw = active_job.metadata_info.get("report_id")
            rep_id = uuid.UUID(rep_id_raw) if rep_id_raw else None
            job_status = HandoverGenerationJobStatus(
                job_id=active_job.id,
                status=active_job.status.value,
                progress=active_job.progress,
                error=active_job.error,
                report_id=rep_id,
                created_at=active_job.created_at,
            )

        return LatestHandoverResponse(report=detail_read, active_job=job_status)

    async def list_versions(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> list[HandoverReportVersionSummary]:
        """Lists summary metadata of all handover report versions for a project."""
        query = (
            select(HandoverReport)
            .where(HandoverReport.project_id == project_id)
            .order_by(desc(HandoverReport.version))
        )
        res = await db.execute(query)
        reports = res.scalars().all()

        summaries = []
        for r in reports:
            total_c = 0
            ev_count = 0
            if r.content_sections:
                for sec in r.content_sections.values():
                    total_c += len(sec.get("claims", []))
                    ev_count += len(sec.get("evidence_references", []))

            summaries.append(
                HandoverReportVersionSummary(
                    id=r.id,
                    project_id=r.project_id,
                    title=r.title,
                    version=r.version,
                    status=r.status,
                    departing_member_name=r.departing_member_name,
                    focus_area=r.focus_area,
                    total_claims=total_c,
                    evidence_count=ev_count,
                    generated_at=r.generated_at,
                    approved_at=r.approved_at,
                    approved_by_id=r.approved_by_id,
                )
            )

        return summaries

    async def get_version(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        version_or_id: str,
    ) -> HandoverReportDetailRead:
        """Retrieves a specific handover report version by version number (int) or report UUID."""
        target_uuid: uuid.UUID | None = None
        target_ver: int | None = None

        try:
            target_uuid = uuid.UUID(version_or_id)
        except ValueError:
            try:
                target_ver = int(version_or_id)
            except ValueError:
                raise NotFoundError(
                    message=f"Invalid version identifier '{version_or_id}'."
                ) from None

        query = select(HandoverReport).where(HandoverReport.project_id == project_id)
        if target_uuid:
            query = query.where(HandoverReport.id == target_uuid)
        else:
            query = query.where(HandoverReport.version == target_ver)

        res = await db.execute(query)
        report = res.scalar_one_or_none()
        if not report:
            raise NotFoundError(message=f"Handover report version '{version_or_id}' not found.")

        return self._hydrate_report_from_db(report)

    async def submit_for_review(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        report_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> HandoverReportDetailRead:
        """Submits a draft report for peer/lead review (transitions status to IN_REVIEW)."""
        report = await self._get_report_model(db, project_id, report_id)

        # Immutability check
        if report.status == HandoverReportStatus.APPROVED:
            raise ConflictError(
                message="Approved handover reports are immutable and cannot be submitted."
            )

        report.status = HandoverReportStatus.IN_REVIEW
        await db.commit()
        await db.refresh(report)

        await self.audit_service.record_audit_event(
            db=db,
            project_id=project_id,
            actor_id=user_id,
            action="handover_submit",
            entity_type="handover_report",
            entity_id=report.id,
            details={"version": report.version, "status": report.status.value},
        )

        return self._hydrate_report_from_db(report)

    async def review_report(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        report_id: uuid.UUID,
        user_id: uuid.UUID,
        action: str,
        comment: str | None = None,
    ) -> HandoverReportDetailRead:
        """Reviews a handover report with 'approve' or 'reject' action and audited feedback."""
        report = await self._get_report_model(db, project_id, report_id)

        # Immutability check: approved reports are immutable
        if report.status == HandoverReportStatus.APPROVED:
            raise ConflictError(
                message="Approved handover reports are immutable and cannot be reviewed again."
            )

        act_norm = action.lower().strip()
        if act_norm == "approve":
            report.status = HandoverReportStatus.APPROVED
            report.approved_by_id = user_id
            report.approved_at = datetime.now(UTC)
            report.review_comment = comment
            audit_action = "handover_approve"
        elif act_norm == "reject":
            report.status = HandoverReportStatus.DRAFT
            report.review_comment = comment
            audit_action = "handover_reject"
        else:
            raise ValueError(f"Unknown review action '{action}'. Must be 'approve' or 'reject'.")

        await db.commit()
        await db.refresh(report)

        await self.audit_service.record_audit_event(
            db=db,
            project_id=project_id,
            actor_id=user_id,
            action=audit_action,
            entity_type="handover_report",
            entity_id=report.id,
            details={"version": report.version, "action": act_norm, "comment": comment},
        )

        return self._hydrate_report_from_db(report)

    async def diff_reports(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        v1: int,
        v2: int,
    ) -> HandoverDiffResponse:
        """Compares two report versions at a section level (claims count, evidence count, narrative diff)."""
        rep1 = await self.get_version(db, project_id, str(v1))
        rep2 = await self.get_version(db, project_id, str(v2))

        all_sec_keys = sorted(set(rep1.sections.keys()) | set(rep2.sections.keys()))
        diff_sections: list[HandoverDiffSection] = []

        for k in all_sec_keys:
            s1 = rep1.sections.get(k)
            s2 = rep2.sections.get(k)

            s1_claims_cnt = len(s1.claims) if s1 else 0
            s2_claims_cnt = len(s2.claims) if s2 else 0
            s1_ev_cnt = len(s1.evidence_references) if s1 else 0
            s2_ev_cnt = len(s2.evidence_references) if s2 else 0

            s1_narrative = (s1.narrative if s1 else "").strip()
            s2_narrative = (s2.narrative if s2 else "").strip()
            content_changed = (s1_narrative != s2_narrative) or (s1_claims_cnt != s2_claims_cnt)

            title = s2.title if s2 else (s1.title if s1 else k)
            diff_sections.append(
                HandoverDiffSection(
                    section_key=k,
                    section_title=title,
                    v1_claims_count=s1_claims_cnt,
                    v2_claims_count=s2_claims_cnt,
                    v1_evidence_count=s1_ev_cnt,
                    v2_evidence_count=s2_ev_cnt,
                    content_changed=content_changed,
                    v1_summary=s1_narrative[:120] if s1_narrative else "None",
                    v2_summary=s2_narrative[:120] if s2_narrative else "None",
                )
            )

        return HandoverDiffResponse(
            project_id=project_id,
            v1_version=v1,
            v2_version=v2,
            v1_status=rep1.status.value,
            v2_status=rep2.status.value,
            section_diffs=diff_sections,
        )

    async def _get_report_model(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        report_id: uuid.UUID,
    ) -> HandoverReport:
        q = select(HandoverReport).where(
            HandoverReport.id == report_id,
            HandoverReport.project_id == project_id,
        )
        res = await db.execute(q)
        report = res.scalar_one_or_none()
        if not report:
            raise NotFoundError(message=f"Handover report {report_id} not found in this project.")
        return report

    def _hydrate_report_from_db(self, report: HandoverReport) -> HandoverReportDetailRead:
        raw_sections = report.content_sections or {}
        sections: dict[str, HandoverSection] = {}
        all_evidences_map: dict[str, EvidenceReference] = {}
        total_claims = 0
        verified_claims = 0
        unverified_claims = 0

        for k, v in raw_sections.items():
            if isinstance(v, dict):
                v_copy = dict(v)
                if "key" not in v_copy:
                    v_copy["key"] = k
                sec_obj = HandoverSection.model_validate(v_copy)
            else:
                sec_obj = HandoverSection.model_validate(v)
            sections[k] = sec_obj
            total_claims += len(sec_obj.claims)
            verified_claims += sum(1 for c in sec_obj.claims if c.verified)
            unverified_claims += sum(1 for c in sec_obj.claims if not c.verified)
            for ev in sec_obj.evidence_references:
                all_evidences_map[str(ev.evidence_id)] = ev

        return HandoverReportDetailRead(
            id=report.id,
            project_id=report.project_id,
            title=report.title,
            version=report.version,
            status=report.status,
            departing_member_name=report.departing_member_name,
            focus_area=report.focus_area,
            approved_only=report.approved_only,
            review_comment=report.review_comment,
            sections=sections,
            all_evidence_references=list(all_evidences_map.values()),
            total_claims=total_claims,
            verified_claims=verified_claims,
            unverified_claims=unverified_claims,
            generated_at=report.generated_at,
            created_by_id=report.created_by_id,
            approved_by_id=report.approved_by_id,
            approved_at=report.approved_at,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    def _build_detail_read(
        self,
        report: HandoverReport,
        sections: dict[str, HandoverSection],
        all_evidences: list[EvidenceReference],
        total_claims: int,
        verified_claims: int,
        unverified_claims: int,
    ) -> HandoverReportDetailRead:
        return HandoverReportDetailRead(
            id=report.id,
            project_id=report.project_id,
            title=report.title,
            version=report.version,
            status=report.status,
            departing_member_name=report.departing_member_name,
            focus_area=report.focus_area,
            approved_only=report.approved_only,
            review_comment=report.review_comment,
            sections=sections,
            all_evidence_references=all_evidences,
            total_claims=total_claims,
            verified_claims=verified_claims,
            unverified_claims=unverified_claims,
            generated_at=report.generated_at,
            created_by_id=report.created_by_id,
            approved_by_id=report.approved_by_id,
            approved_at=report.approved_at,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )


_global_handover_service: HandoverService | None = None


def get_handover_service() -> HandoverService:
    global _global_handover_service
    if _global_handover_service is None:
        _global_handover_service = HandoverService()
    return _global_handover_service
