import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.enums import KnowledgeCategory, KnowledgeOrigin, KnowledgeReviewStatus, TaskStatus
from app.models.evidence import Evidence
from app.models.knowledge import KnowledgeItem
from app.models.task import Task
from app.schemas.knowledge import (
    BulkReviewRequest,
    ConflictItemRead,
    GapItemRead,
    KnowledgeItemReviewRequest,
)


class KnowledgeService:
    """Business logic for knowledge items, verification auditing, tasks, dependencies, and gaps."""

    async def list_knowledge_items(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        category: KnowledgeCategory | None = None,
        review_status: KnowledgeReviewStatus | None = None,
        origin: KnowledgeOrigin | None = None,
        min_confidence: float | None = None,
        max_confidence: float | None = None,
        verified: bool | None = None,
        q: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[KnowledgeItem]:
        """Lists knowledge items for a project with rich filtering and pagination."""
        query = (
            select(KnowledgeItem)
            .where(KnowledgeItem.project_id == project_id)
            .options(selectinload(KnowledgeItem.evidences))
        )

        if category is not None:
            query = query.where(KnowledgeItem.category == category)
        if review_status is not None:
            query = query.where(KnowledgeItem.review_status == review_status)
        if origin is not None:
            query = query.where(KnowledgeItem.origin == origin)
        if min_confidence is not None:
            query = query.where(KnowledgeItem.confidence >= min_confidence)
        if max_confidence is not None:
            query = query.where(KnowledgeItem.confidence <= max_confidence)
        if q:
            search_pattern = f"%{q.strip()}%"
            query = query.where(
                (KnowledgeItem.title.ilike(search_pattern))
                | (KnowledgeItem.description.ilike(search_pattern))
            )

        if verified is not None:
            if verified:
                # Has at least one verified evidence
                query = query.where(KnowledgeItem.evidences.any(Evidence.verified.is_(True)))
            else:
                # Does NOT have any verified evidence
                query = query.where(~KnowledgeItem.evidences.any(Evidence.verified.is_(True)))

        query = query.order_by(KnowledgeItem.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_knowledge_item(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> KnowledgeItem:
        """Fetches a single knowledge item with loaded evidence, tasks, and dependencies."""
        query = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.id == item_id,
                KnowledgeItem.project_id == project_id,
            )
            .options(
                selectinload(KnowledgeItem.evidences),
                selectinload(KnowledgeItem.tasks),
                selectinload(KnowledgeItem.source_dependencies),
                selectinload(KnowledgeItem.target_dependencies),
            )
        )
        result = await db.execute(query)
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(message=f"Knowledge item {item_id} not found in this project.")
        return item

    async def review_knowledge_item(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        item_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        review_data: KnowledgeItemReviewRequest,
    ) -> KnowledgeItem:
        """Audited review (approve, reject, edit) of a knowledge item by a designated reviewer."""
        item = await self.get_knowledge_item(db=db, project_id=project_id, item_id=item_id)

        item.review_status = review_data.review_status
        item.reviewer_id = reviewer_id
        item.reviewed_at = datetime.now(UTC)

        if review_data.review_note is not None:
            if item.review_note:
                item.review_note = f"{item.review_note} | [Review Note]: {review_data.review_note}"
            else:
                item.review_note = f"[Review Note]: {review_data.review_note}"

        if review_data.title is not None and review_data.title.strip():
            item.title = review_data.title.strip()

        if review_data.description is not None and review_data.description.strip():
            item.description = review_data.description.strip()

        await db.commit()
        return await self.get_knowledge_item(db=db, project_id=project_id, item_id=item_id)

    async def bulk_review_knowledge_items(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        bulk_data: BulkReviewRequest,
    ) -> int:
        """Performs bulk review status updates across multiple knowledge items for a project."""
        query = select(KnowledgeItem).where(
            KnowledgeItem.project_id == project_id,
            KnowledgeItem.id.in_(bulk_data.item_ids),
        )
        result = await db.execute(query)
        items = result.scalars().all()

        now = datetime.now(UTC)
        updated_count = 0
        for item in items:
            item.review_status = bulk_data.review_status
            item.reviewer_id = reviewer_id
            item.reviewed_at = now
            if bulk_data.review_note:
                if item.review_note:
                    item.review_note = (
                        f"{item.review_note} | [Bulk Review]: {bulk_data.review_note}"
                    )
                else:
                    item.review_note = f"[Bulk Review]: {bulk_data.review_note}"
            updated_count += 1

        await db.commit()
        return updated_count

    async def list_project_tasks(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        status: TaskStatus | None = None,
        owner_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        """Lists tasks for a project with optional status/owner filtering."""
        query = select(Task).where(Task.project_id == project_id)
        if status is not None:
            query = query.where(Task.status == status)
        if owner_id is not None:
            query = query.where(Task.owner_id == owner_id)

        query = query.order_by(Task.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def list_project_gaps(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> list[GapItemRead]:
        """Identifies flagged knowledge gaps (missing owners/dates, missing rationale/mitigation, unverified)."""
        query = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.project_id == project_id,
                KnowledgeItem.review_note.is_not(None),
            )
            .order_by(KnowledgeItem.created_at.desc())
        )
        result = await db.execute(query)
        items = result.scalars().all()

        gaps: list[GapItemRead] = []
        for item in items:
            note = item.review_note or ""
            if "GAP:" in note or "UNVERIFIED_EVIDENCE" in note:
                gap_type = (
                    "unverified_evidence"
                    if "UNVERIFIED_EVIDENCE" in note
                    else "missing_information"
                )
                if "missing owner" in note:
                    gap_type = "missing_task_owner_or_date"
                elif "missing rationale" in note:
                    gap_type = "missing_rationale"
                elif "missing mitigation" in note:
                    gap_type = "missing_mitigation"

                gaps.append(
                    GapItemRead(
                        id=item.id,
                        category=item.category,
                        title=item.title,
                        gap_type=gap_type,
                        details=note,
                        confidence=item.confidence,
                        review_status=item.review_status,
                    )
                )

        return gaps

    async def list_project_conflicts(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> list[ConflictItemRead]:
        """Lists items flagged with conflicting decisions or stances."""
        query = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.project_id == project_id,
                KnowledgeItem.review_note.like("%CONFLICT_DETECTED%"),
            )
            .order_by(KnowledgeItem.created_at.desc())
        )
        result = await db.execute(query)
        items = result.scalars().all()

        conflicts: list[ConflictItemRead] = []
        for item in items:
            conflicts.append(
                ConflictItemRead(
                    knowledge_item_id=item.id,
                    title=item.title,
                    conflict_note=item.review_note or "Conflicting decision detected.",
                )
            )

        return conflicts


knowledge_service = KnowledgeService()
