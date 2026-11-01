from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, ingestion, projects, sources

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(sources.router, prefix="/projects", tags=["sources"])
api_router.include_router(ingestion.router, prefix="/projects", tags=["ingestion"])
