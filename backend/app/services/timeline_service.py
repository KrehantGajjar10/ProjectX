import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import KnowledgeCategory, TaskStatus
from app.models.knowledge import KnowledgeItem
from app.models.source import Source
from app.models.task import Task
from app.schemas.evidence import EvidenceRead
from app.schemas.timeline import TimelineEventRead, TimelineResponse

logger = logging.getLogger(__name__)


class TimelineService:
    """Aggregates chronological timeline events combining milestones, key decisions,

    commit activity, and task status changes with date filters and pagination.
    """

    async def get_project_timeline(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        event_types: list[str] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> TimelineResponse:
        """Retrieves and paginates timeline events in reverse chronological order."""
        events: list[TimelineEventRead] = []

        # 1. Fetch Milestones & Decisions
        kitems_q = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.project_id == project_id,
                KnowledgeItem.category.in_(
                    [KnowledgeCategory.MILESTONE, KnowledgeCategory.DECISION]
                ),
            )
            .options(selectinload(KnowledgeItem.evidences))
        )
        res_k = await db.execute(kitems_q)
        kitems = res_k.scalars().all()

        for k in kitems:
            ev_type = "milestone" if k.category == KnowledgeCategory.MILESTONE else "decision"
            ts = k.reviewed_at or k.created_at
            ev_reads = [EvidenceRead.model_validate(e) for e in k.evidences]

            events.append(
                TimelineEventRead(
                    id=f"{ev_type}_{k.id}",
                    event_type=ev_type,
                    title=k.title,
                    description=k.description,
                    timestamp=ts,
                    actor=str(k.reviewer_id) if k.reviewer_id else None,
                    status=k.review_status.value,
                    metadata_info={
                        "category": k.category.value,
                        "confidence": k.confidence,
                        "origin": k.origin.value,
                    },
                    evidence=ev_reads,
                )
            )

        # 2. Fetch Tasks
        tasks_q = (
            select(Task)
            .where(Task.project_id == project_id)
            .options(selectinload(Task.knowledge_item).selectinload(KnowledgeItem.evidences))
        )
        res_t = await db.execute(tasks_q)
        tasks = res_t.scalars().all()

        for t in tasks:
            task_evs = []
            if t.knowledge_item and t.knowledge_item.evidences:
                task_evs = [EvidenceRead.model_validate(e) for e in t.knowledge_item.evidences]

            # Task Creation event
            events.append(
                TimelineEventRead(
                    id=f"task_created_{t.id}",
                    event_type="task",
                    title=f"Task Created: {t.title}",
                    description=t.description,
                    timestamp=t.created_at,
                    actor=str(t.owner_id) if t.owner_id else None,
                    status=t.status.value,
                    metadata_info={"priority": t.priority, "task_id": str(t.id)},
                    evidence=task_evs,
                )
            )

            # Task Completion event (if completed and updated after creation)
            if t.status == TaskStatus.COMPLETED and t.updated_at > t.created_at:
                events.append(
                    TimelineEventRead(
                        id=f"task_completed_{t.id}",
                        event_type="task",
                        title=f"Task Completed: {t.title}",
                        description=t.description,
                        timestamp=t.updated_at,
                        actor=str(t.owner_id) if t.owner_id else None,
                        status="completed",
                        metadata_info={"priority": t.priority, "task_id": str(t.id)},
                        evidence=task_evs,
                    )
                )

        # 3. Fetch Commit Activity from Sources
        sources_q = select(Source).where(Source.project_id == project_id)
        res_s = await db.execute(sources_q)
        sources = res_s.scalars().all()

        for s in sources:
            commit_history = s.config.get("commit_history", []) if s.config else []
            for c in commit_history:
                raw_date = c.get("date")
                c_date = None
                if raw_date:
                    try:
                        c_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                    except Exception:
                        pass
                if not c_date:
                    c_date = s.created_at

                sha = c.get("sha", "")
                short_sha = sha[:7] if sha else "git"
                msg = c.get("message", "Commit")
                first_line = msg.split("\n")[0] if msg else "Commit"

                events.append(
                    TimelineEventRead(
                        id=f"commit_{short_sha}_{s.id}",
                        event_type="commit",
                        title=f"Commit: {first_line}",
                        description=msg,
                        timestamp=c_date,
                        actor=c.get("author", "Developer"),
                        status="pushed",
                        metadata_info={"sha": sha, "source_name": s.name},
                        evidence=[],
                    )
                )

        # 4. Filter by date and event_types
        filtered = events

        if start_date:
            filtered = [e for e in filtered if e.timestamp >= start_date]
        if end_date:
            filtered = [e for e in filtered if e.timestamp <= end_date]
        if event_types:
            type_set = set(event_types)
            filtered = [e for e in filtered if e.event_type in type_set]

        # 5. Sort reverse chronological
        filtered.sort(key=lambda e: e.timestamp, reverse=True)
        total_count = len(filtered)
        paginated_events = filtered[skip : skip + limit]

        return TimelineResponse(
            events=paginated_events,
            total_events=total_count,
        )


_global_timeline_service: TimelineService | None = None


def get_timeline_service() -> TimelineService:
    global _global_timeline_service
    if _global_timeline_service is None:
        _global_timeline_service = TimelineService()
    return _global_timeline_service
