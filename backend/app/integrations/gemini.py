from typing import Any

from google import genai

from app.core.config import settings


class GeminiClient:
    """Client for Gemini via the google-genai SDK. Does not access database."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured.")
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def generate_text(
        self,
        prompt: str,
        model: str = "gemini-2.5-flash",
        config: dict[str, Any] | None = None,
    ) -> str:
        # google-genai async or sync call
        response = self.client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
        return response.text or ""
