import logging
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.enums import KnowledgeCategory, KnowledgeReviewStatus, TaskStatus
from app.models.ingestion import IngestionJob
from app.models.knowledge import KnowledgeItem
from app.models.project import Project
from app.models.task import Task
from app.schemas.dashboard import DashboardHighlights, ProjectDashboardSummary
from app.schemas.knowledge import KnowledgeItemRead
from app.schemas.task import TaskRead
from app.services.risk_service import get_risk_service
from app.services.task_service import get_task_service
from app.services.timeline_service import get_timeline_service

logger = logging.getLogger(__name__)


class DashboardService:
    """Aggregates all project health metrics, risk summaries, tasks progress,

    recent activity, and critical highlights into a single unified payload for the frontend.
    """

    def __init__(self) -> None:
        self.risk_service = get_risk_service()
        self.task_service = get_task_service()
        self.timeline_service = get_timeline_service()

    async def get_project_dashboard(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> ProjectDashboardSummary:
        """Computes comprehensive project dashboard summary in one call."""
        # 1. Fetch Project
        res_p = await db.execute(select(Project).where(Project.id == project_id))
        project = res_p.scalar_one_or_none()
        if not project:
            raise NotFoundError(message=f"Project {project_id} not found.")

        # 2. Knowledge items stats
        k_q = (
            select(KnowledgeItem)
            .where(KnowledgeItem.project_id == project_id)
            .options(selectinload(KnowledgeItem.evidences))
        )
        res_k = await db.execute(k_q)
        all_kitems = res_k.scalars().all()

        by_cat = Counter(k.category.value for k in all_kitems)
        by_status = Counter(k.review_status.value for k in all_kitems)
        unreviewed = sum(1 for k in all_kitems if k.review_status == KnowledgeReviewStatus.PENDING)

        gaps = 0
        conflicts = 0
        recent_decisions: list[KnowledgeItemRead] = []

        for k in all_kitems:
            note = k.review_note or ""
            if "GAP:" in note or "UNVERIFIED_EVIDENCE" in note:
                gaps += 1
            if "CONFLICT_DETECTED" in note:
                conflicts += 1
            if k.category == KnowledgeCategory.DECISION and len(recent_decisions) < 5:
                recent_decisions.append(KnowledgeItemRead.model_validate(k))

        # 3. Tasks progress
        task_progress = await self.task_service.get_task_progress(db=db, project_id=project_id)

        # 4. Blocked tasks
        blocked_q = (
            select(Task)
            .where(Task.project_id == project_id, Task.status == TaskStatus.BLOCKED)
            .limit(5)
        )
        res_blocked = await db.execute(blocked_q)
        blocked_tasks = [TaskRead.model_validate(t) for t in res_blocked.scalars().all()]

        # 5. Risks summary
        risk_summary = await self.risk_service.get_project_risks(db=db, project_id=project_id)
        critical_risks = [r for r in risk_summary.risks if r.severity in ("critical", "high")][:5]

        # 6. Last ingestion job status
        job_q = (
            select(IngestionJob)
            .where(IngestionJob.project_id == project_id)
            .order_by(IngestionJob.created_at.desc())
            .limit(1)
        )
        res_job = await db.execute(job_q)
        last_job = res_job.scalar_one_or_none()
        last_job_info: dict[str, Any] | None = None
        if last_job:
            last_job_info = {
                "id": str(last_job.id),
                "status": last_job.status.value,
                "progress": last_job.progress,
                "error": last_job.error,
                "created_at": last_job.created_at.isoformat(),
                "completed_at": last_job.completed_at.isoformat()
                if last_job.completed_at
                else None,
            }

        # 7. Recent timeline activity (last 5 events)
        timeline_res = await self.timeline_service.get_project_timeline(
            db=db,
            project_id=project_id,
            skip=0,
            limit=5,
        )

        return ProjectDashboardSummary(
            project_id=project.id,
            name=project.name,
            description=project.description,
            items_by_category=dict(by_cat),
            items_by_review_status=dict(by_status),
            unreviewed_items_count=unreviewed,
            open_risks_by_severity=risk_summary.by_severity,
            total_risks_count=risk_summary.total_risks,
            gaps_count=gaps,
            conflicts_count=conflicts,
            tasks_progress=task_progress,
            last_ingestion_status=last_job_info,
            recent_activity=timeline_res.events,
            highlights=DashboardHighlights(
                critical_risks=critical_risks,
                blocked_tasks=blocked_tasks,
                recent_decisions=recent_decisions,
            ),
        )


_global_dashboard_service: DashboardService | None = None


def get_dashboard_service() -> DashboardService:
    global _global_dashboard_service
    if _global_dashboard_service is None:
        _global_dashboard_service = DashboardService()
    return _global_dashboard_service
