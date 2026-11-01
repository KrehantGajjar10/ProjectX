from typing import Literal

from pydantic import BaseModel, Field


class ExtractedItem(BaseModel):
    """An individual knowledge item extracted from source text by the LLM."""

    title: str = Field(
        ...,
        description="Concise, informative title of the decision, task, risk, milestone, insight, or dependency.",
    )
    description: str = Field(
        ...,
        description="Detailed description or context of the item.",
    )
    category: Literal["decision", "task", "risk", "milestone", "insight", "dependency"] = Field(
        ...,
        description="The category of the extracted knowledge item.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0 based strictly on source clarity.",
    )
    exact_evidence_excerpt: str = Field(
        ...,
        description="Verbatim excerpt from the source text supporting this item. Must match source text.",
    )
    source_locator: str = Field(
        default="",
        description="Reference locator such as file path, section, or line reference.",
    )
    origin: Literal["explicit_fact", "ai_inference"] = Field(
        default="explicit_fact",
        description="'explicit_fact' if stated directly; 'ai_inference' if synthesized by the model.",
    )

    # Decision-specific fields
    rationale: str | None = Field(
        default=None,
        description="Why the decision was made, if explicitly stated.",
    )
    alternatives_considered: str | None = Field(
        default=None,
        description="Alternative options that were evaluated or discarded.",
    )

    # Task-specific fields
    task_owner: str | None = Field(
        default=None,
        description="Person, team, or handle assigned to the task.",
    )
    task_due_date: str | None = Field(
        default=None,
        description="Due date or target timeline if mentioned in source.",
    )
    task_status: str | None = Field(
        default="todo",
        description="Current status if indicated (todo, in_progress, completed).",
    )

    # Risk-specific fields
    risk_severity: str | None = Field(
        default="medium",
        description="Severity level: low, medium, high, critical.",
    )
    risk_mitigation: str | None = Field(
        default=None,
        description="Proposed or active mitigation strategy.",
    )

    # Dependency-specific fields
    target_item_title: str | None = Field(
        default=None,
        description="The title of the entity or task that this item depends upon or blocks.",
    )
    dependency_type: str | None = Field(
        default="depends_on",
        description="Relationship type: depends_on, blocks, relates_to, mitigates.",
    )


class ExtractionResult(BaseModel):
    """Container for batch extraction response from Gemini."""

    items: list[ExtractedItem] = Field(
        default_factory=list,
        description="List of high-confidence, evidence-backed extracted knowledge items.",
    )
