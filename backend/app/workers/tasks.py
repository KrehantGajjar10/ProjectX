import logging
import uuid

from app.workers.ingestion_worker import IngestionWorker

logger = logging.getLogger(__name__)


async def trigger_ingestion_job(job_id: uuid.UUID) -> None:
    """Helper to execute an ingestion job directly."""
    logger.info("Executing job %s via worker runner", job_id)
    worker = IngestionWorker()
    await worker.execute_job(job_id)
    await worker.engine.dispose()
