import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.evidence import Evidence
    from app.models.ingestion import IngestionJob
    from app.models.project import Project
    from app.models.source import Source


class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "documents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ingestion_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingestion_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    file_path: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )
    mime_type: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )
    raw_content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    doc_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="pending",
        index=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="documents")
    source: Mapped["Source | None"] = relationship("Source", back_populates="documents")
    ingestion_job: Mapped["IngestionJob | None"] = relationship(
        "IngestionJob", back_populates="documents"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentChunk.chunk_index",
    )
    evidences: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="document",
    )


class DocumentChunk(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "document_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    token_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    embedding_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    extraction_version: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    location_info: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
    evidences: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="chunk",
    )
