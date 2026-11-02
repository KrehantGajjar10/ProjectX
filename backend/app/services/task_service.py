import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.enums import TaskStatus
from app.models.task import Task
from app.schemas.task import TaskProgressSummary, TaskUpdate

logger = logging.getLogger(__name__)


class TaskService:
    """Task tracking, permissioned updates with audit tracking, and project progress computation."""

    async def list_tasks(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        status: TaskStatus | None = None,
        is_completed: bool | None = None,
        is_blocked: bool | None = None,
        owner_id: uuid.UUID | None = None,
        due_before: datetime | None = None,
        due_after: datetime | None = None,
        priority: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        """Lists and filters tasks for a project with rich filtering."""
        query = select(Task).where(Task.project_id == project_id)

        if status is not None:
            query = query.where(Task.status == status)
        elif is_completed is not None:
            if is_completed:
                query = query.where(Task.status == TaskStatus.COMPLETED)
            else:
                query = query.where(Task.status != TaskStatus.COMPLETED)
        elif is_blocked is not None:
            if is_blocked:
                query = query.where(Task.status == TaskStatus.BLOCKED)
            else:
                query = query.where(Task.status != TaskStatus.BLOCKED)

        if owner_id is not None:
            query = query.where(Task.owner_id == owner_id)
        if due_before is not None:
            query = query.where(Task.due_date <= due_before)
        if due_after is not None:
            query = query.where(Task.due_date >= due_after)
        if priority is not None:
            query = query.where(Task.priority == priority)

        query = (
            query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_task_by_id(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        task_id: uuid.UUID,
    ) -> Task:
        """Fetches a single task by ID."""
        query = select(Task).where(Task.id == task_id, Task.project_id == project_id)
        result = await db.execute(query)
        task = result.scalar_one_or_none()
        if not task:
            raise NotFoundError(message=f"Task {task_id} not found in this project.")
        return task

    async def update_task(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        task_in: TaskUpdate,
    ) -> Task:
        """Audited update of task status, owner, priority, due date, or title."""
        task = await self.get_task_by_id(db=db, project_id=project_id, task_id=task_id)
        now = datetime.now(UTC)

        changes: list[str] = []
        if task_in.status is not None and task_in.status != task.status:
            changes.append(f"status: {task.status.value} -> {task_in.status.value}")
            task.status = task_in.status

        if task_in.owner_id is not None and task_in.owner_id != task.owner_id:
            changes.append(f"owner: {task.owner_id} -> {task_in.owner_id}")
            task.owner_id = task_in.owner_id

        if task_in.priority is not None and task_in.priority != task.priority:
            changes.append(f"priority: {task.priority} -> {task_in.priority}")
            task.priority = task_in.priority

        if task_in.due_date is not None and task_in.due_date != task.due_date:
            changes.append(f"due_date: {task.due_date} -> {task_in.due_date}")
            task.due_date = task_in.due_date

        if task_in.title is not None and task_in.title.strip():
            task.title = task_in.title.strip()

        if task_in.description is not None:
            task.description = task_in.description

        if changes:
            audit_entry = (
                f"[Audit {now.strftime('%Y-%m-%d %H:%M UTC')} by {user_id}]: {', '.join(changes)}"
            )
            if task.description:
                task.description = f"{task.description}\n\n{audit_entry}"
            else:
                task.description = audit_entry

        await db.commit()
        await db.refresh(task)
        return task

    async def get_task_progress(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> TaskProgressSummary:
        """Computes comprehensive project task progress statistics."""
        query = select(Task).where(Task.project_id == project_id)
        result = await db.execute(query)
        tasks = result.scalars().all()

        total = len(tasks)
        completed = 0
        in_progress = 0
        todo = 0
        blocked = 0
        cancelled = 0
        overdue = 0
        unassigned = 0

        now = datetime.now(UTC)

        for t in tasks:
            if t.status == TaskStatus.COMPLETED:
                completed += 1
            elif t.status == TaskStatus.IN_PROGRESS:
                in_progress += 1
            elif t.status == TaskStatus.TODO:
                todo += 1
            elif t.status == TaskStatus.BLOCKED:
                blocked += 1
            elif t.status == TaskStatus.CANCELLED:
                cancelled += 1

            if t.status != TaskStatus.COMPLETED:
                if t.due_date and t.due_date < now:
                    overdue += 1
                if t.owner_id is None:
                    unassigned += 1

        percentage = round((completed / total) * 100.0, 1) if total > 0 else 0.0

        return TaskProgressSummary(
            total_tasks=total,
            completed_tasks=completed,
            in_progress_tasks=in_progress,
            todo_tasks=todo,
            blocked_tasks=blocked,
            cancelled_tasks=cancelled,
            completion_percentage=percentage,
            overdue_tasks=overdue,
            unassigned_tasks=unassigned,
        )


_global_task_service: TaskService | None = None


def get_task_service() -> TaskService:
    global _global_task_service
    if _global_task_service is None:
        _global_task_service = TaskService()
    return _global_task_service
