import logging
import uuid

logger = logging.getLogger(__name__)


async def run_ingestion_job(job_id: uuid.UUID) -> None:
    """Background task to run an ingestion pipeline for a given job."""
    logger.info("Starting background ingestion task for job %s", job_id)
    # Processing pipeline will be executed here by processors and integrations
    logger.info("Ingestion task %s dispatched", job_id)


async def run_report_generation(report_id: uuid.UUID) -> None:
    """Background task to compile a handover report."""
    logger.info("Compiling handover report %s", report_id)
