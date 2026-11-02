from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.integrations.neo4j import get_neo4j_client
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check with DB verification and optional Neo4j reporting",
)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse | JSONResponse:
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {exc}"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "environment": settings.ENVIRONMENT,
                "database": db_status,
                "version": "0.1.0",
            },
        )

    # Neo4j status
    neo4j_client = get_neo4j_client()
    neo4j_info = await neo4j_client.check_health()

    overall_status = "healthy"
    if settings.NEO4J_ENABLED and neo4j_info.get("status", "").startswith("unhealthy"):
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        environment=settings.ENVIRONMENT,
        database=db_status,
        neo4j=neo4j_info,
        version="0.1.0",
    )
