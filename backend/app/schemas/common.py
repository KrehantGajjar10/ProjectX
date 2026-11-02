from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str
    qdrant: dict[str, Any] | None = None
    neo4j: dict[str, Any] | None = None
    demo_mode: bool = False
    version: str = "0.1.0"
