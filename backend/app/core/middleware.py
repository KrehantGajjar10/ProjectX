import logging
import time
import uuid
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import request_id_ctx

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Injects and tracks X-Request-ID for every incoming request and outgoing response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Read or generate request id
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = uuid.uuid4().hex

        # Set context var
        token = request_id_ctx.set(request_id)
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            process_time_ms = (time.perf_counter() - start_time) * 1000.0

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"

            # Log request lifecycle (exclude noisy health probes from info logs)
            if request.url.path not in ("/health", "/api/v1/health"):
                logger.info(
                    "%s %s -> status=%d duration=%.2fms",
                    request.method,
                    request.url.path,
                    response.status_code,
                    process_time_ms,
                )
            return response
        finally:
            request_id_ctx.reset(token)
