from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, ingestion, knowledge, projects, search, sources

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(sources.router, prefix="/projects", tags=["sources"])
api_router.include_router(ingestion.router, prefix="/projects", tags=["ingestion"])
api_router.include_router(knowledge.router, prefix="/projects", tags=["knowledge"])
api_router.include_router(search.router, prefix="/projects", tags=["search"])
