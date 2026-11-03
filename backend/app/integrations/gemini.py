import asyncio
import json
import logging
import random
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.integrations.demo_ai import DemoAIService
from app.prompts.extraction_v1 import (
    EXTRACTION_SYSTEM_INSTRUCTION_V1,
    EXTRACTION_USER_TEMPLATE_V1,
)
from app.prompts.handover_v1 import (
    HANDOVER_SYSTEM_INSTRUCTION_V1,
    HANDOVER_USER_TEMPLATE_V1,
)
from app.prompts.qa_v1 import (
    QA_SYSTEM_INSTRUCTION_V1,
    QA_USER_TEMPLATE_V1,
)
from app.schemas.extraction import ExtractionResult
from app.schemas.search import GroundedQAResult

logger = logging.getLogger(__name__)


class GeminiClient:
    """Dedicated async client for Gemini API using google-genai SDK.

    Configured with model names, temperature, timeouts, retry with exponential backoff,
    rate-limit handling, and concurrency limits from application Settings.
    The integration ONLY communicates with Gemini; it never writes to the database.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
        embedding_model: str | None = None,
        embedding_dimension: int | None = None,
        temperature: float | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        concurrency_limit: int | None = None,
    ) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL
        self.embedding_model = embedding_model or settings.GEMINI_EMBEDDING_MODEL
        self.embedding_dimension = embedding_dimension or settings.GEMINI_EMBEDDING_DIMENSION
        self.temperature = temperature if temperature is not None else settings.GEMINI_TEMPERATURE
        self.timeout = timeout if timeout is not None else settings.GEMINI_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.GEMINI_MAX_RETRIES
        limit = (
            concurrency_limit
            if concurrency_limit is not None
            else settings.GEMINI_CONCURRENCY_LIMIT
        )
        self.semaphore = asyncio.Semaphore(limit)
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured in environment or settings.")
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def extract_knowledge(
        self,
        chunk_content: str,
        file_path: str,
        location_info: dict[str, Any],
    ) -> ExtractionResult:
        """Extracts structured knowledge items from a document chunk using structured outputs."""
        if not chunk_content.strip():
            return ExtractionResult(items=[])

        if settings.DEMO_MODE:
            logger.info("DEMO_MODE active: returning realistic canned extraction response.")
            return DemoAIService.demo_extract_knowledge(
                chunk_content=chunk_content,
                file_path=file_path,
                location_info=location_info,
            )

        prompt = EXTRACTION_USER_TEMPLATE_V1.format(
            file_path=file_path,
            location_info=json.dumps(location_info),
            chunk_content=chunk_content,
        )

        config = types.GenerateContentConfig(
            system_instruction=EXTRACTION_SYSTEM_INSTRUCTION_V1,
            temperature=self.temperature,
            response_mime_type="application/json",
            response_schema=ExtractionResult,
        )

        async with self.semaphore:
            last_err: Exception | None = None
            for attempt in range(self.max_retries + 1):
                try:
                    async with asyncio.timeout(self.timeout):
                        response = await self.client.aio.models.generate_content(
                            model=self.model_name,
                            contents=prompt,
                            config=config,
                        )

                    text_res = response.text
                    if not text_res:
                        return ExtractionResult(items=[])

                    try:
                        return ExtractionResult.model_validate_json(text_res)
                    except Exception as parse_err:
                        try:
                            data = json.loads(text_res)
                            return ExtractionResult.model_validate(data)
                        except Exception:
                            logger.error("Failed to parse Gemini JSON: %s", text_res[:200])
                            raise parse_err from None

                except (TimeoutError, APIError, ConnectionError) as exc:
                    last_err = exc
                    if attempt == self.max_retries:
                        logger.error(
                            "Gemini extraction failed after %d retries: %s",
                            self.max_retries,
                            exc,
                        )
                        raise

                    backoff = (2**attempt) * 2.0 + random.uniform(0.5, 1.5)
                    if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                        backoff = max(backoff, 15.0 + (attempt * 10.0))
                    logger.warning(
                        "Gemini extraction attempt %d failed (%s). Retrying in %.2fs...",
                        attempt + 1,
                        exc,
                        backoff,
                    )
                    await asyncio.sleep(backoff)

            if last_err:
                raise last_err
            return ExtractionResult(items=[])

    async def embed_texts(
        self,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        """Generates embeddings for a batch of texts using the official Gemini embedding model."""
        if not texts:
            return []

        if settings.DEMO_MODE:
            logger.info("DEMO_MODE active: returning deterministic canned embeddings.")
            return DemoAIService.demo_embed_texts(texts, dimension=self.embedding_dimension)

        clean_texts = [t.strip() if t.strip() else " " for t in texts]
        batch_size = settings.EMBEDDING_BATCH_SIZE
        all_embeddings: list[list[float]] = []

        config = types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=self.embedding_dimension,
        )

        for i in range(0, len(clean_texts), batch_size):
            batch = clean_texts[i : i + batch_size]
            async with self.semaphore:
                last_err: Exception | None = None
                for attempt in range(self.max_retries + 1):
                    try:
                        async with asyncio.timeout(self.timeout):
                            response = await self.client.aio.models.embed_content(
                                model=self.embedding_model,
                                contents=batch,
                                config=config,
                            )

                        for emb in response.embeddings:
                            all_embeddings.append(list(emb.values))
                        last_err = None
                        break

                    except (TimeoutError, APIError, ConnectionError) as exc:
                        last_err = exc
                        if attempt == self.max_retries:
                            logger.error(
                                "Gemini embedding failed after %d retries: %s",
                                self.max_retries,
                                exc,
                            )
                            raise

                        backoff = (2**attempt) * 1.0 + random.uniform(0.1, 0.4)
                        logger.warning(
                            "Gemini embedding attempt %d failed (%s). Retrying in %.2fs...",
                            attempt + 1,
                            exc,
                            backoff,
                        )
                        await asyncio.sleep(backoff)

                if last_err:
                    raise last_err

        return all_embeddings

    async def embed_query(self, query: str) -> list[float]:
        """Generates embedding for a single query text using RETRIEVAL_QUERY task type."""
        embeddings = await self.embed_texts([query], task_type="RETRIEVAL_QUERY")
        if not embeddings:
            return [0.0] * self.embedding_dimension
        return embeddings[0]

    async def answer_contextual_qa(
        self,
        question: str,
        chunks_context: str,
        knowledge_context: str,
        history_context: str = "None",
    ) -> GroundedQAResult:
        """Answers a user question grounded exclusively in retrieved context."""
        if settings.DEMO_MODE:
            logger.info("DEMO_MODE active: returning realistic canned Q&A answer.")
            return DemoAIService.demo_contextual_qa(
                question=question,
                chunks_context=chunks_context,
                knowledge_context=knowledge_context,
            )

        prompt = QA_USER_TEMPLATE_V1.format(
            chunks_context=chunks_context or "No chunk context retrieved.",
            knowledge_context=knowledge_context or "No curated knowledge items retrieved.",
            history_context=history_context or "None",
            question=question,
        )

        config = types.GenerateContentConfig(
            system_instruction=QA_SYSTEM_INSTRUCTION_V1,
            temperature=self.temperature,
            response_mime_type="application/json",
            response_schema=GroundedQAResult,
        )

        async with self.semaphore:
            last_err: Exception | None = None
            for attempt in range(self.max_retries + 1):
                try:
                    async with asyncio.timeout(self.timeout):
                        response = await self.client.aio.models.generate_content(
                            model=self.model_name,
                            contents=prompt,
                            config=config,
                        )

                    text_res = response.text
                    if not text_res:
                        return GroundedQAResult(
                            answer="I do not have sufficient information in the provided context to answer this question.",
                            is_sufficient=False,
                            confidence=0.0,
                        )

                    try:
                        return GroundedQAResult.model_validate_json(text_res)
                    except Exception:
                        data = json.loads(text_res)
                        return GroundedQAResult.model_validate(data)

                except (TimeoutError, APIError, ConnectionError) as exc:
                    last_err = exc
                    if attempt == self.max_retries:
                        logger.error(
                            "Gemini Q&A failed after %d retries: %s",
                            self.max_retries,
                            exc,
                        )
                        raise

                    backoff = (2**attempt) * 1.5 + random.uniform(0.1, 0.5)
                    await asyncio.sleep(backoff)

            if last_err:
                raise last_err
            return GroundedQAResult(
                answer="I do not have sufficient information in the provided context to answer this question.",
                is_sufficient=False,
                confidence=0.0,
            )

    async def generate_handover_narrative(
        self,
        project_name: str,
        project_description: str | None,
        departing_member_name: str | None,
        focus_area: str | None,
        approved_only: bool,
        structured_data_json: str,
    ) -> dict[str, Any]:
        """Generates evidence-linked narrative sections for project handover based strictly on structured input."""
        if settings.DEMO_MODE:
            logger.info("DEMO_MODE active: returning realistic canned handover narrative.")
            return DemoAIService.demo_handover_narrative(
                project_name=project_name,
                project_description=project_description,
                departing_member_name=departing_member_name,
                focus_area=focus_area,
                approved_only=approved_only,
                structured_data_json=structured_data_json,
            )

        prompt = HANDOVER_USER_TEMPLATE_V1.format(
            project_name=project_name,
            project_description=project_description or "None",
            departing_member_name=departing_member_name or "None",
            focus_area=focus_area or "All Areas",
            approved_only=str(approved_only),
            structured_data_json=structured_data_json,
        )

        config = types.GenerateContentConfig(
            system_instruction=HANDOVER_SYSTEM_INSTRUCTION_V1,
            temperature=self.temperature,
            response_mime_type="application/json",
        )

        async with self.semaphore:
            last_err: Exception | None = None
            for attempt in range(self.max_retries + 1):
                try:
                    async with asyncio.timeout(self.timeout):
                        response = await self.client.aio.models.generate_content(
                            model=self.model_name,
                            contents=prompt,
                            config=config,
                        )

                    text_res = response.text
                    if not text_res:
                        return {}
                    return json.loads(text_res)

                except (TimeoutError, APIError, ConnectionError) as exc:
                    last_err = exc
                    if attempt == self.max_retries:
                        logger.error(
                            "Gemini handover generation failed after %d retries: %s",
                            self.max_retries,
                            exc,
                        )
                        raise

                    backoff = (2**attempt) * 1.5 + random.uniform(0.1, 0.5)
                    await asyncio.sleep(backoff)

            if last_err:
                raise last_err
            return {}


_global_gemini_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    global _global_gemini_client
    if _global_gemini_client is None:
        _global_gemini_client = GeminiClient()
    return _global_gemini_client
