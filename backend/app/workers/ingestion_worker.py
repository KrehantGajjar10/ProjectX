import asyncio
import logging
import signal
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.enums import IngestionJobStatus
from app.models.ingestion import IngestionJob
from app.models.source import Source
from app.services.ingestion_service import IngestionService
from app.services.storage import StorageBackend

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [ingestion_worker] %(message)s",
)
logger = logging.getLogger(__name__)


class IngestionWorker:
    """Standalone background worker that polls the database queue for ingestion jobs.

    Features:
    - Concurrent polling safety via SELECT ... FOR UPDATE SKIP LOCKED
    - Automatic stuck-job recovery
    - Retry management with configurable limits
    - Graceful shutdown on termination signals
    """

    def __init__(
        self,
        database_url: str | None = None,
        storage: StorageBackend | None = None,
    ) -> None:
        self.db_url = database_url or settings.async_database_url
        self.engine = create_async_engine(
            self.db_url,
            poolclass=NullPool,
            echo=False,
        )
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )
        self.ingestion_service = IngestionService(storage=storage)
        self.is_running = True

    async def recover_stuck_jobs(self, session: AsyncSession) -> int:
        """Finds jobs stuck in 'processing' status beyond the timeout and either requeues or fails them."""
        cutoff = datetime.now(UTC) - timedelta(seconds=settings.INGESTION_STUCK_TIMEOUT_SECONDS)

        query = (
            select(IngestionJob)
            .where(
                IngestionJob.status == IngestionJobStatus.PROCESSING,
                (IngestionJob.heartbeat_at < cutoff)
                | (IngestionJob.heartbeat_at.is_(None) & (IngestionJob.started_at < cutoff)),
            )
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(query)
        stuck_jobs = result.scalars().all()

        recovered_count = 0
        now = datetime.now(UTC)
        for job in stuck_jobs:
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = IngestionJobStatus.QUEUED
                job.error = f"Job heartbeats timed out; auto-requeued (attempt {job.retry_count}/{job.max_retries})"
                logger.warning(
                    "Requeued stuck job %s (attempt %d/%d)",
                    job.id,
                    job.retry_count,
                    job.max_retries,
                )
            else:
                job.status = IngestionJobStatus.FAILED
                job.completed_at = now
                job.error = f"Job exceeded timeout and maximum retry limit ({job.max_retries})"
                logger.error("Marked stuck job %s as FAILED", job.id)
            recovered_count += 1

        if recovered_count > 0:
            await session.commit()

        return recovered_count

    async def claim_next_job(self, session: AsyncSession) -> IngestionJob | None:
        """Claims the next available queued job using row-level locking."""
        query = (
            select(IngestionJob)
            .where(IngestionJob.status == IngestionJobStatus.QUEUED)
            .order_by(IngestionJob.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        result = await session.execute(query)
        job = result.scalar_one_or_none()

        if job:
            now = datetime.now(UTC)
            job.status = IngestionJobStatus.PROCESSING
            job.started_at = now
            job.heartbeat_at = now
            job.progress = 5
            await session.commit()
            logger.info("Claimed ingestion job %s (project: %s)", job.id, job.project_id)
            return job

        return None

    async def execute_job(self, job_id: uuid.UUID) -> None:
        """Processes a claimed job to completion."""
        async with self.session_factory() as session:
            job_query = select(IngestionJob).where(IngestionJob.id == job_id)
            res = await session.execute(job_query)
            job = res.scalar_one_or_none()
            if not job:
                logger.error("Job %s disappeared before execution", job_id)
                return

            try:
                # 1. Resolve target sources
                sources_to_ingest: list[Source] = []
                if job.source_id:
                    src_q = select(Source).where(Source.id == job.source_id)
                    s_res = await session.execute(src_q)
                    single_src = s_res.scalar_one_or_none()
                    if single_src:
                        sources_to_ingest.append(single_src)
                else:
                    specified_ids = job.metadata_info.get("source_ids", [])
                    if specified_ids:
                        uuid_ids = [uuid.UUID(str(sid)) for sid in specified_ids]
                        src_q = select(Source).where(
                            Source.project_id == job.project_id,
                            Source.id.in_(uuid_ids),
                        )
                    else:
                        src_q = select(Source).where(Source.project_id == job.project_id)
                    s_res = await session.execute(src_q)
                    sources_to_ingest = list(s_res.scalars().all())

                if not sources_to_ingest:
                    logger.warning(
                        "No sources found for job %s, completing with empty results",
                        job_id,
                    )
                    job.status = IngestionJobStatus.COMPLETED
                    job.progress = 100
                    job.completed_at = datetime.now(UTC)
                    await session.commit()
                    return

                total_sources = len(sources_to_ingest)
                all_stats = []

                # 2. Process each source
                for idx, source in enumerate(sources_to_ingest):
                    logger.info(
                        "Job %s: ingesting source '%s' (%s) [%d/%d]",
                        job_id,
                        source.name,
                        source.type,
                        idx + 1,
                        total_sources,
                    )
                    stats = await self.ingestion_service.ingest_source(
                        db=session,
                        project_id=job.project_id,
                        source=source,
                        job_id=job.id,
                    )
                    all_stats.append(stats)

                    # Update progress & heartbeat
                    now = datetime.now(UTC)
                    job.heartbeat_at = now
                    job.progress = 5 + int(((idx + 1) / total_sources) * 90)
                    await session.commit()

                # 3. Mark completed
                now = datetime.now(UTC)
                job.status = IngestionJobStatus.COMPLETED
                job.progress = 100
                job.completed_at = now
                job.error = None
                job.metadata_info = {
                    **job.metadata_info,
                    "summary": all_stats,
                }
                await session.commit()
                logger.info("Successfully completed ingestion job %s", job_id)

            except Exception as exc:
                await session.rollback()
                now = datetime.now(UTC)
                err_msg = f"{type(exc).__name__}: {str(exc)}"
                logger.exception("Failed executing job %s: %s", job_id, err_msg)

                # Re-fetch job object to update status
                job_res = await session.execute(
                    select(IngestionJob).where(IngestionJob.id == job_id)
                )
                j = job_res.scalar_one_or_none()
                if j:
                    j.error = err_msg
                    j.heartbeat_at = now
                    if j.retry_count < j.max_retries:
                        j.retry_count += 1
                        j.status = IngestionJobStatus.QUEUED
                        logger.warning(
                            "Job %s failed; requeued for retry (%d/%d)",
                            j.id,
                            j.retry_count,
                            j.max_retries,
                        )
                    else:
                        j.status = IngestionJobStatus.FAILED
                        j.completed_at = now
                        logger.error(
                            "Job %s failed permanently after %d retries",
                            j.id,
                            j.max_retries,
                        )
                    await session.commit()

    async def step(self) -> bool:
        """Performs a single polling cycle. Returns True if a job was claimed and executed."""
        async with self.session_factory() as session:
            await self.recover_stuck_jobs(session)
            job = await self.claim_next_job(session)

        if job:
            await self.execute_job(job.id)
            return True

        return False

    async def run(self) -> None:
        """Main worker execution loop."""
        logger.info("Ingestion worker started, polling database queue...")

        def _handle_shutdown(signum, _frame):
            logger.info("Received signal %s, initiating graceful shutdown...", signum)
            self.is_running = False

        try:
            signal.signal(signal.SIGINT, _handle_shutdown)
            signal.signal(signal.SIGTERM, _handle_shutdown)
        except (ValueError, AttributeError):
            # signal registration may be restricted in non-main threads or some environments
            pass

        while self.is_running:
            try:
                claimed = await self.step()
                if not claimed:
                    await asyncio.sleep(settings.INGESTION_WORKER_POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in worker loop: %s", exc)
                await asyncio.sleep(settings.INGESTION_WORKER_POLL_INTERVAL_SECONDS)

        logger.info("Ingestion worker stopped cleanly.")
        await self.engine.dispose()


async def main() -> None:
    worker = IngestionWorker()
    await worker.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)
