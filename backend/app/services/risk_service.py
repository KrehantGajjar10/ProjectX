import logging
import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import KnowledgeCategory, TaskStatus
from app.models.knowledge import KnowledgeItem
from app.models.source import Source
from app.models.task import Task
from app.schemas.evidence import EvidenceRead
from app.schemas.risk import RiskItemRead, RiskSummaryRead

logger = logging.getLogger(__name__)


class RiskService:
    """Combines extracted risks with deterministic computed signals

    (overdue tasks, missing owners, conflicts, unverified evidence, stale tasks, SPOK).
    """

    async def get_project_risks(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        severity: str | None = None,
        category: str | None = None,
        source_type: str | None = None,
    ) -> RiskSummaryRead:
        """Computes and aggregates all extracted and calculated risk signals for a project."""
        now = datetime.now(UTC)
        all_risks: list[RiskItemRead] = []

        # -------------------------------------------------------------
        # 1. Extracted Risks from KnowledgeItems
        # -------------------------------------------------------------
        extracted_q = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.project_id == project_id,
                KnowledgeItem.category == KnowledgeCategory.RISK,
            )
            .options(selectinload(KnowledgeItem.evidences))
        )
        res_ext = await db.execute(extracted_q)
        extracted_items = res_ext.scalars().all()

        for item in extracted_items:
            # Determine severity deterministically
            text_lower = f"{item.title} {item.description}".lower()
            if any(
                w in text_lower
                for w in ["critical", "security", "data loss", "breach", "outage", "exploit"]
            ):
                sev = "critical"
            elif any(
                w in text_lower for w in ["high", "delay", "performance", "bottleneck", "deadlock"]
            ):
                sev = "high"
            elif any(w in text_lower for w in ["low", "minor", "cosmetic", "cleanup"]):
                sev = "low"
            else:
                sev = "medium"

            evidence_reads = [EvidenceRead.model_validate(e) for e in item.evidences]
            all_risks.append(
                RiskItemRead(
                    id=f"extracted_{item.id}",
                    title=item.title,
                    description=item.description,
                    category="extracted_risk",
                    severity=sev,
                    rationale=item.review_note
                    or f"AI identified explicit risk (confidence: {item.confidence:.2f})",
                    source_type="extracted",
                    confidence=item.confidence,
                    entity_id=item.id,
                    evidence=evidence_reads,
                )
            )

        # -------------------------------------------------------------
        # 2. Computed Signal: Overdue Tasks
        # -------------------------------------------------------------
        tasks_q = (
            select(Task)
            .where(Task.project_id == project_id)
            .options(selectinload(Task.knowledge_item).selectinload(KnowledgeItem.evidences))
        )
        res_tasks = await db.execute(tasks_q)
        all_tasks = res_tasks.scalars().all()

        for t in all_tasks:
            if t.status != TaskStatus.COMPLETED and t.due_date is not None:
                if t.due_date < now:
                    days_overdue = (now - t.due_date).days
                    sev = "critical" if days_overdue >= 7 else "high"
                    k_evidences: list[EvidenceRead] = []
                    if t.knowledge_item and t.knowledge_item.evidences:
                        k_evidences = [
                            EvidenceRead.model_validate(e) for e in t.knowledge_item.evidences
                        ]

                    all_risks.append(
                        RiskItemRead(
                            id=f"overdue_task_{t.id}",
                            title=f"Overdue Task: {t.title}",
                            description=f"Task was due on {t.due_date.strftime('%Y-%m-%d')} ({days_overdue} days ago) and is still {t.status.value}.",
                            category="schedule",
                            severity=sev,
                            rationale="Overdue tasks threaten project delivery milestones and cause cascading schedule delays.",
                            source_type="computed_signal",
                            confidence=1.0,
                            entity_id=t.id,
                            evidence=k_evidences,
                        )
                    )

        # -------------------------------------------------------------
        # 3. Computed Signal: Tasks Without Owners
        # -------------------------------------------------------------
        for t in all_tasks:
            if t.status != TaskStatus.COMPLETED and t.owner_id is None:
                sev = "medium"
                if t.due_date and (t.due_date - now).days <= 3:
                    sev = "high"

                k_evidences = []
                if t.knowledge_item and t.knowledge_item.evidences:
                    k_evidences = [
                        EvidenceRead.model_validate(e) for e in t.knowledge_item.evidences
                    ]

                all_risks.append(
                    RiskItemRead(
                        id=f"unassigned_task_{t.id}",
                        title=f"Unassigned Task: {t.title}",
                        description="Task has no designated owner assigned.",
                        category="ownership",
                        severity=sev,
                        rationale="Unowned tasks lack accountability and are prone to being overlooked during handover.",
                        source_type="computed_signal",
                        confidence=1.0,
                        entity_id=t.id,
                        evidence=k_evidences,
                    )
                )

        # -------------------------------------------------------------
        # 4. Computed Signal: Stale Tasks (no updates > 14 days)
        # -------------------------------------------------------------
        for t in all_tasks:
            if t.status in (TaskStatus.TODO, TaskStatus.IN_PROGRESS):
                if t.updated_at < now - timedelta(days=14):
                    stale_days = (now - t.updated_at).days
                    all_risks.append(
                        RiskItemRead(
                            id=f"stale_task_{t.id}",
                            title=f"Stale Inactive Task: {t.title}",
                            description=f"Task has received no updates or status transitions for {stale_days} days.",
                            category="stale_task",
                            severity="medium",
                            rationale="Long-stale tasks often indicate hidden blockers, abandoned efforts, or stale requirements.",
                            source_type="computed_signal",
                            confidence=1.0,
                            entity_id=t.id,
                        )
                    )

        # -------------------------------------------------------------
        # 5. Computed Signal: Unresolved Architectural Conflicts
        # -------------------------------------------------------------
        all_kitems_q = (
            select(KnowledgeItem)
            .where(KnowledgeItem.project_id == project_id)
            .options(selectinload(KnowledgeItem.evidences))
        )
        res_kall = await db.execute(all_kitems_q)
        all_kitems = res_kall.scalars().all()

        for k in all_kitems:
            note = k.review_note or ""
            if "[CONFLICT_DETECTED]" in note:
                all_risks.append(
                    RiskItemRead(
                        id=f"conflict_{k.id}",
                        title=f"Unresolved Technical Conflict: {k.title}",
                        description=f"Item is flagged with opposing decision conclusions: {note}",
                        category="conflict",
                        severity="high",
                        rationale="Unresolved decision contradictions create architectural friction and inconsistent implementation.",
                        source_type="computed_signal",
                        confidence=k.confidence,
                        entity_id=k.id,
                        evidence=[EvidenceRead.model_validate(e) for e in k.evidences],
                    )
                )

        # -------------------------------------------------------------
        # 6. Computed Signal: Unverified Evidence & Low Confidence
        # -------------------------------------------------------------
        for k in all_kitems:
            note = k.review_note or ""
            has_unverified = "[UNVERIFIED_EVIDENCE]" in note or any(
                not e.verified for e in k.evidences
            )
            is_low_confidence = k.confidence < 0.70

            if has_unverified or is_low_confidence:
                sev = (
                    "high"
                    if k.category in (KnowledgeCategory.DECISION, KnowledgeCategory.RISK)
                    else "medium"
                )
                reasons = []
                if has_unverified:
                    reasons.append("Grounding evidence could not be verified against source text")
                if is_low_confidence:
                    reasons.append(f"Low AI extraction confidence ({k.confidence:.2f})")

                all_risks.append(
                    RiskItemRead(
                        id=f"unverified_evidence_{k.id}",
                        title=f"Unverified Grounding: {k.title}",
                        description=f"{' and '.join(reasons)}.",
                        category="unverified_evidence",
                        severity=sev,
                        rationale="Unverified knowledge items may introduce erroneous assumptions into handover documentation.",
                        source_type="computed_signal",
                        confidence=k.confidence,
                        entity_id=k.id,
                        evidence=[EvidenceRead.model_validate(e) for e in k.evidences],
                    )
                )

        # -------------------------------------------------------------
        # 7. Computed Signal: Single Point of Knowledge (SPOK)
        # -------------------------------------------------------------
        sources_q = select(Source).where(Source.project_id == project_id)
        res_src = await db.execute(sources_q)
        sources = res_src.scalars().all()

        for s in sources:
            commit_history = s.config.get("commit_history", []) if s.config else []
            if commit_history:
                authors = [c.get("author") for c in commit_history if c.get("author")]
                author_counts = Counter(authors)
                # If 1 author dominates (> 85% of commits) with >= 3 commits
                total_commits = len(authors)
                if total_commits >= 3 and len(author_counts) == 1:
                    sole_author = list(author_counts.keys())[0]
                    all_risks.append(
                        RiskItemRead(
                            id=f"spok_source_{s.id}",
                            title=f"Single Point of Knowledge: {s.name}",
                            description=f"Repository/Source '{s.name}' has 100% of analyzed commits ({total_commits}) authored exclusively by {sole_author}.",
                            category="single_point_of_knowledge",
                            severity="high",
                            rationale="High bus factor risk: loss of this single contributor leaves zero codebase knowledge distribution.",
                            source_type="computed_signal",
                            confidence=1.0,
                            entity_id=s.id,
                        )
                    )

        # -------------------------------------------------------------
        # Filter and Summarize
        # -------------------------------------------------------------
        filtered_risks = all_risks

        if severity:
            sev_norm = severity.lower().strip()
            filtered_risks = [r for r in filtered_risks if r.severity == sev_norm]
        if category:
            cat_norm = category.lower().strip()
            filtered_risks = [r for r in filtered_risks if r.category == cat_norm]
        if source_type:
            st_norm = source_type.lower().strip()
            filtered_risks = [r for r in filtered_risks if r.source_type == st_norm]

        # Calculate breakdown summaries across all detected risks
        by_severity = Counter(r.severity for r in all_risks)
        by_category = Counter(r.category for r in all_risks)
        by_source_type = Counter(r.source_type for r in all_risks)

        return RiskSummaryRead(
            total_risks=len(filtered_risks),
            by_severity=dict(by_severity),
            by_category=dict(by_category),
            by_source_type=dict(by_source_type),
            risks=filtered_risks,
        )


_global_risk_service: RiskService | None = None


def get_risk_service() -> RiskService:
    global _global_risk_service
    if _global_risk_service is None:
        _global_risk_service = RiskService()
    return _global_risk_service
