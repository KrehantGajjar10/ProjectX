import time
from collections import defaultdict
from typing import ClassVar

from fastapi import Request, status

from app.core.config import settings
from app.core.exceptions import AppException


class RateLimitExceededError(AppException):
    def __init__(
        self,
        retry_after: int = 60,
        message: str = "Rate limit exceeded. Please wait before retrying.",
    ):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="RATE_LIMIT_EXCEEDED",
            message=message,
            details={"retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )
        self.retry_after = retry_after


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter for client requests."""

    _instances: ClassVar[dict[str, "InMemoryRateLimiter"]] = {}

    def __init__(self, key: str, max_requests: int, window_seconds: int = 60) -> None:
        self.key = key
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Maps client_identifier -> list of timestamps
        self.history: dict[str, list[float]] = defaultdict(list)

    @classmethod
    def get_limiter(
        cls, name: str, max_requests: int, window_seconds: int = 60
    ) -> "InMemoryRateLimiter":
        if name not in cls._instances:
            cls._instances[name] = cls(name, max_requests, window_seconds)
        return cls._instances[name]

    def _cleanup_old_requests(self, client_id: str, current_time: float) -> None:
        cutoff = current_time - self.window_seconds
        self.history[client_id] = [t for t in self.history[client_id] if t > cutoff]

    def is_allowed(self, client_id: str) -> tuple[bool, int]:
        """Checks if client is allowed to make request.

        Returns (allowed, retry_after_seconds).
        """
        now = time.time()
        self._cleanup_old_requests(client_id, now)

        if len(self.history[client_id]) >= self.max_requests:
            oldest = self.history[client_id][0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)))
            return False, retry_after

        self.history[client_id].append(now)
        return True, 0

    def reset(self) -> None:
        """Resets tracked request history (useful for testing)."""
        self.history.clear()


def get_client_identifier(request: Request) -> str:
    """Extracts client IP or forward-for address."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    if client and client.host:
        return client.host
    return "127.0.0.1"


class RateLimitDependency:
    """FastAPI dependency for endpoint-level rate limiting."""

    def __init__(self, limiter_name: str, get_limit: int | None = None) -> None:
        self.limiter_name = limiter_name
        self.custom_limit = get_limit

    async def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return

        limit = self.custom_limit or (
            settings.RATE_LIMIT_EXPENSIVE_PER_MINUTE
            if "expensive" in self.limiter_name
            else settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        )

        limiter = InMemoryRateLimiter.get_limiter(self.limiter_name, max_requests=limit)
        client_id = get_client_identifier(request)

        allowed, retry_after = limiter.is_allowed(client_id)
        if not allowed:
            raise RateLimitExceededError(retry_after=retry_after)


# Common dependencies
rate_limit_expensive = RateLimitDependency("expensive_endpoints")
rate_limit_general = RateLimitDependency("general_endpoints")
