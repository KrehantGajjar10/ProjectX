import enum


class ProjectRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    REVIEWER = "reviewer"
    MEMBER = "member"
    VIEWER = "viewer"


class IngestionJobStatus(enum.StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class DocumentStatus(enum.StrEnum):
    PENDING = "pending"
    PARSED = "parsed"
    INDEXED = "indexed"
    FAILED = "failed"


class KnowledgeCategory(enum.StrEnum):
    DECISION = "decision"
    TASK = "task"
    RISK = "risk"
    MILESTONE = "milestone"
    INSIGHT = "insight"


class KnowledgeOrigin(enum.StrEnum):
    EXPLICIT_FACT = "explicit_fact"
    AI_INFERENCE = "ai_inference"


class KnowledgeReviewStatus(enum.StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaskStatus(enum.StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class HandoverReportStatus(enum.StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


# Helper for role hierarchy comparisons
ROLE_HIERARCHY = {
    ProjectRole.VIEWER: 1,
    ProjectRole.MEMBER: 2,
    ProjectRole.REVIEWER: 3,
    ProjectRole.ADMIN: 4,
    ProjectRole.OWNER: 5,
}


def has_minimum_role(user_role: ProjectRole | str, required_role: ProjectRole | str) -> bool:
    try:
        user_r = ProjectRole(user_role)
        req_r = ProjectRole(required_role)
        return ROLE_HIERARCHY[user_r] >= ROLE_HIERARCHY[req_r]
    except (KeyError, ValueError):
        return False
