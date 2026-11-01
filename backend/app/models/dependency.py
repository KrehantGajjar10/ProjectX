import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.evidence import Evidence
    from app.models.knowledge import KnowledgeItem
    from app.models.project import Project
    from app.models.task import Task


class Dependency(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "dependencies"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Edge endpoints - can connect KnowledgeItem to KnowledgeItem, Task to Task, or KnowledgeItem to Task
    source_knowledge_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    target_knowledge_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    source_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    target_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    evidence_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evidences.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="dependencies")
    source_knowledge_item: Mapped["KnowledgeItem | None"] = relationship(
        "KnowledgeItem",
        foreign_keys=[source_knowledge_item_id],
        back_populates="source_dependencies",
    )
    target_knowledge_item: Mapped["KnowledgeItem | None"] = relationship(
        "KnowledgeItem",
        foreign_keys=[target_knowledge_item_id],
        back_populates="target_dependencies",
    )
    source_task: Mapped["Task | None"] = relationship(
        "Task",
        foreign_keys=[source_task_id],
        back_populates="source_dependencies",
    )
    target_task: Mapped["Task | None"] = relationship(
        "Task",
        foreign_keys=[target_task_id],
        back_populates="target_dependencies",
    )
    evidence: Mapped["Evidence | None"] = relationship(
        "Evidence",
        foreign_keys=[evidence_id],
        back_populates="dependencies",
    )
