from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    dashboard,
    dependencies,
    health,
    ingestion,
    knowledge,
    projects,
    risks,
    search,
    sources,
    tasks,
    timeline,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(sources.router, prefix="/projects", tags=["sources"])
api_router.include_router(ingestion.router, prefix="/projects", tags=["ingestion"])
api_router.include_router(knowledge.router, prefix="/projects", tags=["knowledge"])
api_router.include_router(search.router, prefix="/projects", tags=["search"])
api_router.include_router(dependencies.router, prefix="/projects", tags=["dependencies"])
api_router.include_router(risks.router, prefix="/projects", tags=["risks"])
api_router.include_router(timeline.router, prefix="/projects", tags=["timeline"])
api_router.include_router(tasks.router, prefix="/projects", tags=["tasks"])
api_router.include_router(dashboard.router, prefix="/projects", tags=["dashboard"])
