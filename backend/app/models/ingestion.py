import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import IngestionJobStatus

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.project import Project
    from app.models.source import Source


class IngestionJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ingestion_jobs"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    status: Mapped[IngestionJobStatus] = mapped_column(
        SQLEnum(IngestionJobStatus, name="ingestion_job_status_enum", native_enum=False),
        nullable=False,
        default=IngestionJobStatus.QUEUED,
        index=True,
    )
    progress: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    metadata_info: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="ingestion_jobs")
    source: Mapped["Source | None"] = relationship("Source", back_populates="ingestion_jobs")
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="ingestion_job",
        cascade="all, delete-orphan",
    )
