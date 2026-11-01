from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.handover import HandoverReport
    from app.models.knowledge import KnowledgeItem
    from app.models.member import ProjectMember
    from app.models.project import Project
    from app.models.task import Task


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    memberships: Mapped[list["ProjectMember"]] = relationship(
        "ProjectMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    created_projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="creator",
        foreign_keys="Project.created_by_id",
    )
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="owner",
        foreign_keys="Task.owner_id",
    )
    reviewed_knowledge_items: Mapped[list["KnowledgeItem"]] = relationship(
        "KnowledgeItem",
        back_populates="reviewer",
        foreign_keys="KnowledgeItem.reviewer_id",
    )
    approved_reports: Mapped[list["HandoverReport"]] = relationship(
        "HandoverReport",
        back_populates="approved_by",
        foreign_keys="HandoverReport.approved_by_id",
    )
