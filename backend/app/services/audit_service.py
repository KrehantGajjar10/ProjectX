import logging
import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.schemas.audit import AuditLogRead, ProjectActivityResponse

logger = logging.getLogger(__name__)


class AuditService:
    """Records and retrieves project audit logs for actions, reviews, approvals, and exports."""

    async def record_audit_event(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID | None = None,
        actor_id: uuid.UUID | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Persists an audit log record for project activities."""
        audit_entry = AuditLog(
            project_id=project_id,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)
        return audit_entry

    async def list_project_activity(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        action: str | None = None,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> ProjectActivityResponse:
        """Retrieves paginated audit log entries for a project with actor information."""
        base_filter = [AuditLog.project_id == project_id]
        if action:
            base_filter.append(AuditLog.action == action)
        if entity_type:
            base_filter.append(AuditLog.entity_type == entity_type)

        # Count total
        count_q = select(func.count()).select_from(AuditLog).where(*base_filter)
        total_res = await db.execute(count_q)
        total = total_res.scalar_one()

        # Query items
        items_q = (
            select(AuditLog)
            .where(*base_filter)
            .options(selectinload(AuditLog.actor))
            .order_by(desc(AuditLog.created_at))
            .offset(skip)
            .limit(limit)
        )
        res = await db.execute(items_q)
        logs = res.scalars().all()

        read_items: list[AuditLogRead] = []
        for log_entry in logs:
            actor_name = log_entry.actor.full_name if log_entry.actor else None
            actor_email = log_entry.actor.email if log_entry.actor else None
            read_items.append(
                AuditLogRead(
                    id=log_entry.id,
                    project_id=log_entry.project_id,
                    actor_id=log_entry.actor_id,
                    actor_name=actor_name,
                    actor_email=actor_email,
                    action=log_entry.action,
                    entity_type=log_entry.entity_type,
                    entity_id=log_entry.entity_id,
                    details=log_entry.details,
                    created_at=log_entry.created_at,
                )
            )

        return ProjectActivityResponse(
            items=read_items,
            total=total,
            skip=skip,
            limit=limit,
        )


_global_audit_service: AuditService | None = None


def get_audit_service() -> AuditService:
    global _global_audit_service
    if _global_audit_service is None:
        _global_audit_service = AuditService()
    return _global_audit_service
