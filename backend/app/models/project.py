import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.audit import AuditLog
    from app.models.dependency import Dependency
    from app.models.document import Document
    from app.models.evidence import Evidence
    from app.models.handover import HandoverReport
    from app.models.ingestion import IngestionJob
    from app.models.knowledge import KnowledgeItem
    from app.models.member import ProjectMember
    from app.models.source import Source
    from app.models.task import Task
    from app.models.user import User


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    creator: Mapped["User | None"] = relationship(
        "User",
        back_populates="created_projects",
        foreign_keys=[created_by_id],
    )
    members: Mapped[list["ProjectMember"]] = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    sources: Mapped[list["Source"]] = relationship(
        "Source",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    ingestion_jobs: Mapped[list["IngestionJob"]] = relationship(
        "IngestionJob",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    knowledge_items: Mapped[list["KnowledgeItem"]] = relationship(
        "KnowledgeItem",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    evidences: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    handover_reports: Mapped[list["HandoverReport"]] = relationship(
        "HandoverReport",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="project",
        cascade="all, delete-orphan",
    )
