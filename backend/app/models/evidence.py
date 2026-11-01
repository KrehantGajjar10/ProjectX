import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.dependency import Dependency
    from app.models.document import Document, DocumentChunk
    from app.models.knowledge import KnowledgeItem
    from app.models.project import Project


class Evidence(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "evidences"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    knowledge_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_locator: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,
    )
    exact_excerpt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )
    confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="evidences")
    knowledge_item: Mapped["KnowledgeItem"] = relationship(
        "KnowledgeItem", back_populates="evidences"
    )
    document: Mapped["Document | None"] = relationship("Document", back_populates="evidences")
    chunk: Mapped["DocumentChunk | None"] = relationship(
        "DocumentChunk", back_populates="evidences"
    )
    dependencies: Mapped[list["Dependency"]] = relationship(
        "Dependency",
        back_populates="evidence",
    )
