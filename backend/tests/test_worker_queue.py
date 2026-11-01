from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import IngestionJobStatus
from app.models.ingestion import IngestionJob
from app.models.source import Source
from app.workers.ingestion_worker import IngestionWorker


@pytest.mark.asyncio
async def test_worker_claim_and_execute_job(db_session: AsyncSession, project_a, tmp_path):
    worker = IngestionWorker(database_url=settings.async_test_database_url)

    # Create dummy source and job
    source = Source(
        project_id=project_a.id,
        name="Worker Test Source",
        type="upload",
        config={"files": []},
    )
    db_session.add(source)
    await db_session.flush()

    job = IngestionJob(
        project_id=project_a.id,
        source_id=source.id,
        status=IngestionJobStatus.QUEUED,
        progress=0,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    # 1. Claim next job
    claimed_job = await worker.claim_next_job(db_session)
    assert claimed_job is not None
    assert claimed_job.id == job.id
    assert claimed_job.status == IngestionJobStatus.PROCESSING
    assert claimed_job.progress == 5
    assert claimed_job.started_at is not None

    target_job_id = job.id

    # 2. Execute job
    await worker.execute_job(target_job_id)

    # 3. Verify job completed
    db_session.expire_all()
    refreshed_job = (
        await db_session.execute(select(IngestionJob).where(IngestionJob.id == target_job_id))
    ).scalar_one()

    assert refreshed_job.status == IngestionJobStatus.COMPLETED
    assert refreshed_job.progress == 100
    assert refreshed_job.completed_at is not None
    assert refreshed_job.error is None

    await worker.engine.dispose()


@pytest.mark.asyncio
async def test_worker_stuck_job_recovery(db_session: AsyncSession, project_a):
    worker = IngestionWorker(database_url=settings.async_test_database_url)

    # Create a job stuck in PROCESSING from 20 minutes ago
    twenty_mins_ago = datetime.now(UTC) - timedelta(minutes=20)
    stuck_job = IngestionJob(
        project_id=project_a.id,
        status=IngestionJobStatus.PROCESSING,
        progress=30,
        retry_count=0,
        max_retries=2,
        started_at=twenty_mins_ago,
        heartbeat_at=twenty_mins_ago,
    )
    db_session.add(stuck_job)
    await db_session.commit()

    # Run recovery
    recovered_count = await worker.recover_stuck_jobs(db_session)
    assert recovered_count == 1

    refreshed = (
        await db_session.execute(select(IngestionJob).where(IngestionJob.id == stuck_job.id))
    ).scalar_one()
    # Should be requeued with retry_count = 1
    assert refreshed.status == IngestionJobStatus.QUEUED
    assert refreshed.retry_count == 1
    assert "auto-requeued" in refreshed.error

    # Now simulate it getting stuck again, but reaching max retries
    refreshed.status = IngestionJobStatus.PROCESSING
    refreshed.heartbeat_at = twenty_mins_ago
    refreshed.retry_count = 2  # equals max_retries
    await db_session.commit()

    recovered_count_2 = await worker.recover_stuck_jobs(db_session)
    assert recovered_count_2 == 1

    failed_job = (
        await db_session.execute(select(IngestionJob).where(IngestionJob.id == stuck_job.id))
    ).scalar_one()
    # Should be marked FAILED
    assert failed_job.status == IngestionJobStatus.FAILED
    assert "maximum retry limit" in failed_job.error

    await worker.engine.dispose()
