import asyncio
import logging
import re
import uuid
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.gemini import GeminiClient, get_gemini_client
from app.models.dependency import Dependency
from app.models.document import Document, DocumentChunk
from app.models.enums import (
    KnowledgeCategory,
    KnowledgeOrigin,
    KnowledgeReviewStatus,
    TaskStatus,
)
from app.models.evidence import Evidence
from app.models.knowledge import KnowledgeItem
from app.models.task import Task
from app.schemas.extraction import ExtractedItem
from app.services.evidence_verifier import verify_evidence

logger = logging.getLogger(__name__)


def compute_string_similarity(str1: str, str2: str) -> float:
    """Computes similarity ratio between two strings."""
    s1 = re.sub(r"\W+", " ", str1).strip().lower()
    s2 = re.sub(r"\W+", " ", str2).strip().lower()
    return SequenceMatcher(None, s1, s2).ratio()


def detect_conflicting_decisions(item_a: ExtractedItem, item_b: ExtractedItem) -> bool:
    """Detects if two decisions on the same topic have conflicting conclusions."""
    if item_a.category != "decision" or item_b.category != "decision":
        return False

    title_sim = compute_string_similarity(item_a.title, item_b.title)
    if title_sim < 0.70:
        return False

    desc_a = item_a.description.lower()
    desc_b = item_b.description.lower()

    # Contradiction polarity indicators
    contrasting_pairs = [
        ("use", "avoid"),
        ("enable", "disable"),
        ("migrate to", "stay on"),
        ("adopt", "deprecate"),
        ("approved", "rejected"),
        ("keep", "remove"),
        ("internal", "external"),
    ]

    for p1, p2 in contrasting_pairs:
        if (p1 in desc_a and p2 in desc_b) or (p2 in desc_a and p1 in desc_b):
            return True

    return False


class ExtractionService:
    """Coordinates batch chunk extraction, evidence verification, deduplication, and relational persistence."""

    def __init__(self, gemini_client: GeminiClient | None = None) -> None:
        self.gemini = gemini_client or get_gemini_client()

    async def extract_chunk_items(
        self, chunk: DocumentChunk, file_path: str
    ) -> list[tuple[ExtractedItem, bool, float, str]]:
        """Invokes Gemini to extract knowledge items from a single chunk and verifies each excerpt."""
        try:
            result = await self.gemini.extract_knowledge(
                chunk_content=chunk.content,
                file_path=file_path,
                location_info=chunk.location_info,
            )
        except Exception as exc:
            logger.error("Gemini extraction error on chunk %s: %s", chunk.id, exc)
            return []

        verified_items: list[tuple[ExtractedItem, bool, float, str]] = []

        for item in result.items:
            # Programmatically verify evidence excerpt
            is_verified, match_score, verified_excerpt = verify_evidence(
                chunk_content=chunk.content,
                excerpt=item.exact_evidence_excerpt,
            )
            verified_items.append((item, is_verified, match_score, verified_excerpt))

        return verified_items

    async def process_project_extraction(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        progress_callback: Any = None,
    ) -> dict[str, Any]:
        """Runs the complete AI extraction and reconstruction pipeline across all project chunks."""
        # 0. Check if Gemini API key is configured
        if not getattr(self.gemini, "api_key", None):
            logger.warning(
                "Project %s: GEMINI_API_KEY is not configured. Skipping AI extraction stage.",
                project_id,
            )
            return {
                "extracted_chunks": 0,
                "items_created": 0,
                "evidences_merged": 0,
                "gaps_flagged": 0,
                "conflicts_flagged": 0,
                "skipped_reason": "GEMINI_API_KEY_NOT_CONFIGURED",
            }

        # 1. Fetch chunks that need extraction (idempotent: skip chunks already at current extraction_version)
        query = (
            select(DocumentChunk, Document.file_path)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                Document.project_id == project_id,
                Document.status != "removed",
                (DocumentChunk.extraction_version != settings.EXTRACTION_VERSION)
                | (DocumentChunk.extraction_version.is_(None)),
            )
            .order_by(DocumentChunk.created_at.asc())
        )
        res = await db.execute(query)
        unextracted_chunks = res.all()

        total_chunks = len(unextracted_chunks)
        if total_chunks == 0:
            logger.info(
                "Project %s: all chunks are already extracted at %s",
                project_id,
                settings.EXTRACTION_VERSION,
            )
            return {
                "extracted_chunks": 0,
                "items_created": 0,
                "evidences_merged": 0,
                "gaps_flagged": 0,
            }

        logger.info("Project %s: extracting knowledge from %d chunks", project_id, total_chunks)

        # 2. Extract per chunk with bounded concurrency
        batch_size = settings.EXTRACTION_BATCH_SIZE
        all_raw_extractions: list[tuple[DocumentChunk, ExtractedItem, bool, float, str]] = []

        for i in range(0, total_chunks, batch_size):
            batch = unextracted_chunks[i : i + batch_size]
            tasks = [
                self.extract_chunk_items(chunk=chunk, file_path=fpath) for chunk, fpath in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for (chunk, _), items_res in zip(batch, batch_results, strict=False):
                if isinstance(items_res, list):
                    for item, is_verified, match_score, excerpt in items_res:
                        all_raw_extractions.append((chunk, item, is_verified, match_score, excerpt))

            if progress_callback:
                progress_pct = int(((i + len(batch)) / total_chunks) * 50)
                await progress_callback(progress_pct)

        # 3. Load existing KnowledgeItems for this project to deduplicate against
        existing_items_q = select(KnowledgeItem).where(KnowledgeItem.project_id == project_id)
        res_existing = await db.execute(existing_items_q)
        saved_items = list(res_existing.scalars().all())

        items_created = 0
        evidences_merged = 0
        gaps_flagged = 0
        conflicts_flagged = 0

        # In-memory mapping of items created in this run
        active_items: list[KnowledgeItem] = list(saved_items)
        created_tasks: list[Task] = []
        pending_dependencies: list[tuple[KnowledgeItem, ExtractedItem]] = []

        # 4. Deduplicate, merge evidence, and detect gaps/conflicts
        for chunk, item, is_verified, match_score, verified_excerpt in all_raw_extractions:
            cat_enum = (
                KnowledgeCategory(item.category)
                if item.category in KnowledgeCategory._value2member_map_
                else KnowledgeCategory.INSIGHT
            )
            origin_enum = (
                KnowledgeOrigin.EXPLICIT_FACT
                if item.origin == "explicit_fact"
                else KnowledgeOrigin.AI_INFERENCE
            )

            # Check for near-duplicate item in active_items
            matched_existing: KnowledgeItem | None = None
            for existing in active_items:
                if existing.category == cat_enum:
                    sim = compute_string_similarity(item.title, existing.title)
                    if sim >= 0.82:
                        matched_existing = existing
                        break

            # Gap flags evaluation
            gap_notes: list[str] = []
            if not is_verified:
                gap_notes.append(
                    "[UNVERIFIED_EVIDENCE] Excerpt could not be verified in source chunk."
                )
                gaps_flagged += 1

            if cat_enum == KnowledgeCategory.TASK and (
                not item.task_owner or not item.task_due_date
            ):
                gap_notes.append("[GAP: Task missing owner or due date]")
                gaps_flagged += 1

            if cat_enum == KnowledgeCategory.DECISION and not item.rationale:
                gap_notes.append("[GAP: Decision missing rationale or alternatives]")
                gaps_flagged += 1

            if cat_enum == KnowledgeCategory.RISK and not item.risk_mitigation:
                gap_notes.append("[GAP: Risk missing mitigation plan]")
                gaps_flagged += 1

            # Conflict detection against existing decisions
            if cat_enum == KnowledgeCategory.DECISION:
                for existing in active_items:
                    if existing.category == KnowledgeCategory.DECISION:
                        if detect_conflicting_decisions(
                            item,
                            ExtractedItem(
                                title=existing.title,
                                description=existing.description,
                                category="decision",
                                confidence=existing.confidence,
                                exact_evidence_excerpt="",
                            ),
                        ):
                            conflict_note = (
                                f"[CONFLICT_DETECTED] Conflicting decision with '{existing.title}'"
                            )
                            gap_notes.append(conflict_note)
                            conflicts_flagged += 1
                            logger.warning(
                                "Conflict detected between '%s' and '%s'",
                                item.title,
                                existing.title,
                            )

            combined_note = " | ".join(gap_notes) if gap_notes else None

            if matched_existing:
                # Deduplicate: merge evidence into existing KnowledgeItem
                evidences_merged += 1
                evidence = Evidence(
                    project_id=project_id,
                    knowledge_item_id=matched_existing.id,
                    document_id=chunk.document_id,
                    chunk_id=chunk.id,
                    source_locator=item.source_locator or chunk.location_info.get("file_path", ""),
                    exact_excerpt=verified_excerpt,
                    verified=is_verified,
                    confidence=match_score,
                )
                db.add(evidence)

                # Append any new gap notes if not already present
                if combined_note:
                    if matched_existing.review_note:
                        if combined_note not in matched_existing.review_note:
                            matched_existing.review_note += f" | {combined_note}"
                    else:
                        matched_existing.review_note = combined_note

            else:
                # Create new KnowledgeItem
                items_created += 1
                new_kitem = KnowledgeItem(
                    project_id=project_id,
                    category=cat_enum,
                    title=item.title.strip(),
                    description=item.description.strip(),
                    confidence=item.confidence,
                    origin=origin_enum,
                    review_status=KnowledgeReviewStatus.PENDING,
                    review_note=combined_note,
                )
                db.add(new_kitem)
                await db.flush()  # assign new_kitem.id

                # Attach Evidence
                evidence = Evidence(
                    project_id=project_id,
                    knowledge_item_id=new_kitem.id,
                    document_id=chunk.document_id,
                    chunk_id=chunk.id,
                    source_locator=item.source_locator or chunk.location_info.get("file_path", ""),
                    exact_excerpt=verified_excerpt,
                    verified=is_verified,
                    confidence=match_score,
                )
                db.add(evidence)
                active_items.append(new_kitem)

                # If category is TASK, create Task row relationally
                if cat_enum == KnowledgeCategory.TASK:
                    task = Task(
                        project_id=project_id,
                        knowledge_item_id=new_kitem.id,
                        title=item.title.strip(),
                        description=item.description.strip(),
                        status=TaskStatus.TODO,
                        priority="medium",
                    )
                    db.add(task)
                    created_tasks.append(task)

                # Track if dependency resolution is needed
                if item.target_item_title or item.category == "dependency":
                    pending_dependencies.append((new_kitem, item))

        # 5. Resolve relational dependency edges
        for kitem, extracted in pending_dependencies:
            target_title = (extracted.target_item_title or extracted.title).strip().lower()
            target_match = next(
                (
                    other
                    for other in active_items
                    if other.id != kitem.id and target_title in other.title.lower()
                ),
                None,
            )
            if target_match:
                dep_edge = Dependency(
                    project_id=project_id,
                    source_knowledge_item_id=kitem.id,
                    target_knowledge_item_id=target_match.id,
                    type=extracted.dependency_type or "depends_on",
                    evidence_text=extracted.exact_evidence_excerpt,
                )
                db.add(dep_edge)

        # 6. Mark chunks as extracted with the current version
        for chunk, _ in unextracted_chunks:
            chunk.extraction_version = settings.EXTRACTION_VERSION

        await db.flush()

        logger.info(
            "Extraction completed for project %s: %d items created, %d evidences merged, %d gaps, %d conflicts",
            project_id,
            items_created,
            evidences_merged,
            gaps_flagged,
            conflicts_flagged,
        )

        return {
            "extracted_chunks": total_chunks,
            "items_created": items_created,
            "evidences_merged": evidences_merged,
            "gaps_flagged": gaps_flagged,
            "conflicts_flagged": conflicts_flagged,
        }


_global_extraction_service: ExtractionService | None = None


def get_extraction_service() -> ExtractionService:
    global _global_extraction_service
    if _global_extraction_service is None:
        _global_extraction_service = ExtractionService()
    return _global_extraction_service
