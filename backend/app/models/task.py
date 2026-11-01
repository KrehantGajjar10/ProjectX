import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TaskStatus

if TYPE_CHECKING:
    from app.models.dependency import Dependency
    from app.models.knowledge import KnowledgeItem
    from app.models.project import Project
    from app.models.user import User


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    knowledge_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus, name="task_status_enum", native_enum=False),
        nullable=False,
        default=TaskStatus.TODO,
        index=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="medium",
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    knowledge_item: Mapped["KnowledgeItem | None"] = relationship(
        "KnowledgeItem", back_populates="tasks"
    )
    owner: Mapped["User | None"] = relationship(
        "User",
        back_populates="assigned_tasks",
        foreign_keys=[owner_id],
    )
    source_dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="source_task",
        foreign_keys="Dependency.source_task_id",
        cascade="all, delete-orphan",
    )
    target_dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="target_task",
        foreign_keys="Dependency.target_task_id",
        cascade="all, delete-orphan",
    )
