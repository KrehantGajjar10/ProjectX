import hashlib
import json
import logging
import math
import random
from typing import Any

from app.schemas.extraction import ExtractedItem, ExtractionResult
from app.schemas.search import GroundedQAResult

logger = logging.getLogger(__name__)


class DemoAIService:
    """Provides realistic canned AI responses when DEMO_MODE=True.

    Every response is clearly marked as demo data with [DEMO_MODE] prefix or tag.
    Ensures zero external API spend and works fully offline.
    """

    @staticmethod
    def demo_extract_knowledge(
        chunk_content: str,
        file_path: str,
        location_info: dict[str, Any],
    ) -> ExtractionResult:
        """Extracts realistic knowledge items using exact substrings from chunk_content as evidence."""
        if not chunk_content or not chunk_content.strip():
            return ExtractionResult(items=[])

        # Find substantial non-empty lines / sentences in the chunk
        lines = [line.strip() for line in chunk_content.split("\n") if len(line.strip()) >= 20]
        if not lines:
            sentences = [s.strip() for s in chunk_content.split(".") if len(s.strip()) >= 15]
            lines = sentences

        if not lines:
            return ExtractionResult(items=[])

        items: list[ExtractedItem] = []
        categories = [
            ("decision", "Architecture & Design Decision", "explicit_fact"),
            ("task", "Implementation Action Item", "explicit_fact"),
            ("dependency", "Component Dependency", "ai_inference"),
            ("risk", "Identified System Risk", "ai_inference"),
            ("milestone", "Project Milestone & Release", "explicit_fact"),
        ]

        # Extract up to 3 realistic items
        for i, line in enumerate(lines[:3]):
            cat_name, cat_label, origin = categories[i % len(categories)]
            title_sample = line[:50].strip(" -#*`")
            item = ExtractedItem(
                category=cat_name,  # type: ignore[arg-type]
                title=f"[DEMO_MODE] {cat_label}: {title_sample}",
                description=f"[DEMO_MODE] Automatically extracted from {file_path} in demo mode.",
                confidence=0.92 - (i * 0.05),
                exact_evidence_excerpt=line,  # Exact excerpt guarantees verification passes!
                source_locator=f"{file_path}#L{i + 1}",
                origin=origin,  # type: ignore[arg-type]
            )
            items.append(item)

        return ExtractionResult(items=items)

    @staticmethod
    def demo_embed_texts(texts: list[str], dimension: int = 768) -> list[list[float]]:
        """Generates deterministic unit-normalized pseudo-embedding vectors of requested dimension."""
        embeddings: list[list[float]] = []
        for text in texts:
            seed_bytes = hashlib.sha256(text.encode("utf-8")).digest()
            seed_int = int.from_bytes(seed_bytes[:8], byteorder="big")
            rng = random.Random(seed_int)

            raw_vec = [rng.gauss(0.0, 1.0) for _ in range(dimension)]
            norm = math.sqrt(sum(x * x for x in raw_vec)) or 1.0
            unit_vec = [x / norm for x in raw_vec]
            embeddings.append(unit_vec)
        return embeddings

    @staticmethod
    def demo_embed_query(query: str, dimension: int = 768) -> list[float]:
        """Generates a deterministic unit-normalized pseudo-embedding for a query string."""
        results = DemoAIService.demo_embed_texts([query], dimension=dimension)
        return results[0] if results else [0.0] * dimension

    @staticmethod
    def demo_contextual_qa(
        question: str,
        chunks_context: str,
        knowledge_context: str,
    ) -> GroundedQAResult:
        """Answers contextual Q&A using realistic canned synthesis clearly marked with [DEMO_MODE]."""
        clean_q = question.strip()
        answer = (
            f"[DEMO_MODE] According to verified project documentation, regarding '{clean_q}': "
            "ProjectX is structured as a modular monolith leveraging PostgreSQL 17 for relational state, "
            "Qdrant for semantic vector indexing, and Gemini for verified knowledge extraction. "
            "All claims and tasks maintain end-to-end evidence linkage to source documents."
        )
        return GroundedQAResult(
            answer=answer,
            citations=[],
            is_sufficient=True,
            confidence=0.94,
        )

    @staticmethod
    def demo_handover_narrative(
        project_name: str,
        project_description: str | None,
        departing_member_name: str | None,
        focus_area: str | None,
        approved_only: bool,
        structured_data_json: str,
    ) -> dict[str, Any]:
        """Generates a complete 10-section handover report narrative referencing structured item IDs."""
        data: dict[str, Any] = {}
        try:
            data = json.loads(structured_data_json)
        except Exception:
            pass

        items = data.get("items", [])

        # Collect available item IDs
        item_ids = [item.get("id") for item in items if item.get("id")]

        departing_str = departing_member_name or "Departing Engineer"
        focus_str = focus_area or "Complete System"

        def _make_claims(text: str, target_id: str | None) -> list[dict[str, Any]]:
            ids = [target_id] if target_id and target_id in item_ids else []
            return [
                {
                    "text": f"[DEMO_MODE] {text}",
                    "statement": f"[DEMO_MODE] {text}",
                    "referenced_item_ids": ids,
                    "item_ids": ids,
                    "verified": True,
                }
            ]

        return {
            "project_overview": {
                "key": "project_overview",
                "title": "[DEMO_MODE] Project Overview & Current State",
                "narrative": f"[DEMO_MODE] {project_name} handover report prepared for {departing_str} covering {focus_str}. The architecture is built on FastAPI, PostgreSQL, and Qdrant.",
                "claims": _make_claims(
                    "Core architecture initialized and running in production mode.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "completed_work": {
                "key": "completed_work",
                "title": "[DEMO_MODE] Completed Work & Milestone Delivery",
                "narrative": "[DEMO_MODE] Delivered initial backend core services, multi-format processors, and automated evidence-verification pipeline.",
                "claims": _make_claims(
                    "Ingestion pipeline and multi-format parser completed.",
                    item_ids[1] if len(item_ids) > 1 else (item_ids[0] if item_ids else None),
                ),
                "evidence_references": [],
            },
            "pending_tasks": {
                "key": "pending_tasks",
                "title": "[DEMO_MODE] Pending, In-Progress & Blocked Tasks",
                "narrative": "[DEMO_MODE] Remaining operational items including test coverage verification and frontend integration handoff.",
                "claims": _make_claims(
                    "Frontend API contract and documentation ready for handoff.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "key_decisions": {
                "key": "key_decisions",
                "title": "[DEMO_MODE] Key Architectural Decisions & Rationale",
                "narrative": "[DEMO_MODE] Adopted SQLAlchemy 2.0 async with asyncpg and strictly partitioned Qdrant vector retrieval by project ID.",
                "claims": _make_claims(
                    "Tenant isolation enforced across all vector searches.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "risks_and_mitigations": {
                "key": "risks_and_mitigations",
                "title": "[DEMO_MODE] Open Risks, Severity & Mitigation Strategies",
                "narrative": "[DEMO_MODE] Evaluated single point of knowledge dependencies and LLM API rate limiting boundaries.",
                "claims": _make_claims(
                    "Exponential backoff and rate limiter protect Gemini and Qdrant endpoints.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "dependencies_critical_paths": {
                "key": "dependencies_critical_paths",
                "title": "[DEMO_MODE] Component Dependencies & Critical Paths",
                "narrative": "[DEMO_MODE] PostgreSQL recursive queries calculate dependency DAGs and identify blocked chains without Neo4j dependency.",
                "claims": _make_claims(
                    "PostgreSQL recursive queries detect circular dependencies.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "knowledge_gaps_questions": {
                "key": "knowledge_gaps_questions",
                "title": "[DEMO_MODE] Open Questions & Knowledge Gaps",
                "narrative": "[DEMO_MODE] Recommended documenting deployment topology and establishing staging verification routines.",
                "claims": _make_claims(
                    "Staging environment configuration should be verified before handoff.", None
                ),
                "evidence_references": [],
            },
            "unresolved_conflicts": {
                "key": "unresolved_conflicts",
                "title": "[DEMO_MODE] Unresolved Conflicts & Design Trade-offs",
                "narrative": "[DEMO_MODE] Trade-off between synchronous retrieval and async background workers resolved in favor of worker model.",
                "claims": _make_claims(
                    "Background worker model isolates intensive processing from the HTTP loop.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
            "actionable_continuation_plan": {
                "key": "actionable_continuation_plan",
                "title": "[DEMO_MODE] Actionable Continuation Plan",
                "narrative": "[DEMO_MODE] 1. Connect frontend to API guide endpoints. 2. Verify staging health endpoint. 3. Finalize handover sign-off.",
                "claims": _make_claims(
                    "Frontend integration should follow the documented API guide.", None
                ),
                "evidence_references": [],
            },
            "departing_context_who_to_ask": {
                "key": "departing_context_who_to_ask",
                "title": "[DEMO_MODE] Who to Ask & Historical Context",
                "narrative": f"[DEMO_MODE] Historical contributions by {departing_str} concentrated in backend architecture, data pipelines, and evidence verification.",
                "claims": _make_claims(
                    f"Primary knowledge holder for data pipelines is {departing_str}.",
                    item_ids[0] if item_ids else None,
                ),
                "evidence_references": [],
            },
        }
