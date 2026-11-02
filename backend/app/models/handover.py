import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import HandoverReportStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class HandoverReport(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "handover_reports"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    status: Mapped[HandoverReportStatus] = mapped_column(
        SQLEnum(HandoverReportStatus, name="handover_report_status_enum", native_enum=False),
        nullable=False,
        default=HandoverReportStatus.DRAFT,
        index=True,
    )
    departing_member_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    focus_area: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    approved_only: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    review_comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    content_sections: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="handover_reports")
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    approved_by: Mapped["User | None"] = relationship(
        "User",
        back_populates="approved_reports",
        foreign_keys=[approved_by_id],
    )
