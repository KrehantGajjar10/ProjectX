from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check with DB verification",
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

    return HealthResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        database=db_status,
        version="0.1.0",
    )
