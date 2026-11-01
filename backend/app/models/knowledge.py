import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import KnowledgeCategory, KnowledgeOrigin, KnowledgeReviewStatus

if TYPE_CHECKING:
    from app.models.dependency import Dependency
    from app.models.evidence import Evidence
    from app.models.project import Project
    from app.models.task import Task
    from app.models.user import User


class KnowledgeItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "knowledge_items"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[KnowledgeCategory] = mapped_column(
        SQLEnum(KnowledgeCategory, name="knowledge_category_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1.0,
    )
    origin: Mapped[KnowledgeOrigin] = mapped_column(
        SQLEnum(KnowledgeOrigin, name="knowledge_origin_enum", native_enum=False),
        nullable=False,
        default=KnowledgeOrigin.EXPLICIT_FACT,
        index=True,
    )
    review_status: Mapped[KnowledgeReviewStatus] = mapped_column(
        SQLEnum(KnowledgeReviewStatus, name="knowledge_review_status_enum", native_enum=False),
        nullable=False,
        default=KnowledgeReviewStatus.PENDING,
        index=True,
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="knowledge_items")
    reviewer: Mapped["User | None"] = relationship(
        "User",
        back_populates="reviewed_knowledge_items",
        foreign_keys=[reviewer_id],
    )
    evidences: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="knowledge_item",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="knowledge_item",
    )
    source_dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="source_knowledge_item",
        foreign_keys="Dependency.source_knowledge_item_id",
        cascade="all, delete-orphan",
    )
    target_dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="target_knowledge_item",
        foreign_keys="Dependency.target_knowledge_item_id",
        cascade="all, delete-orphan",
    )
