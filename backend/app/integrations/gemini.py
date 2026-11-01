import asyncio
import json
import logging
import random
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.prompts.extraction_v1 import (
    EXTRACTION_SYSTEM_INSTRUCTION_V1,
    EXTRACTION_USER_TEMPLATE_V1,
)
from app.schemas.extraction import ExtractionResult

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
        temperature: float | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        concurrency_limit: int | None = None,
    ) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL
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
                    response = await asyncio.wait_for(
                        self.client.aio.models.generate_content(
                            model=self.model_name,
                            contents=prompt,
                            config=config,
                        ),
                        timeout=self.timeout,
                    )

                    text_content = response.text or ""
                    if not text_content:
                        return ExtractionResult(items=[])

                    try:
                        parsed_json = json.loads(text_content)
                        return ExtractionResult.model_validate(parsed_json)
                    except Exception as parse_err:
                        logger.warning(
                            "Failed to parse structured response on attempt %d: %s. Response text: %s",
                            attempt,
                            parse_err,
                            text_content[:200],
                        )
                        if attempt == self.max_retries:
                            raise parse_err

                except (TimeoutError, APIError, ConnectionError) as exc:
                    last_err = exc
                    if attempt == self.max_retries:
                        logger.error(
                            "Gemini extraction failed after %d retries: %s",
                            self.max_retries,
                            exc,
                        )
                        raise

                    backoff = (2**attempt) * 1.5 + random.uniform(0.1, 0.5)
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


_global_gemini_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    global _global_gemini_client
    if _global_gemini_client is None:
        _global_gemini_client = GeminiClient()
    return _global_gemini_client
