from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User

test_engine = create_async_engine(
    settings.async_test_database_url,
    poolclass=NullPool,
    echo=False,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Ensure test database exists and create tables for testing."""
    default_engine = create_async_engine(
        settings.async_database_url,
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    test_db_name = f"{settings.POSTGRES_DB}_test"
    try:
        async with default_engine.connect() as conn:
            check_db = await conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname = '{test_db_name}'")
            )
            if not check_db.scalar():
                await conn.execute(text(f"CREATE DATABASE {test_db_name}"))
    except Exception as e:
        print(f"Warning: could not check/create test database: {e}")
    finally:
        await default_engine.dispose()

    # Create tables in test database
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides a fresh database session for a test with cleanup."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()
        # Clean data from tables
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Test client with get_db dependency overridden."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def user_a(db_session: AsyncSession) -> User:
    user = User(
        email="alice@example.com",
        hashed_password=get_password_hash("StrongPassword123!"),
        full_name="Alice Owner",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def user_a_token(user_a: User) -> str:
    return create_access_token(subject=user_a.id)


@pytest.fixture
def auth_headers_a(user_a_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_a_token}"}


@pytest.fixture
async def user_b(db_session: AsyncSession) -> User:
    user = User(
        email="bob@example.com",
        hashed_password=get_password_hash("StrongPassword123!"),
        full_name="Bob Member",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def user_b_token(user_b: User) -> str:
    return create_access_token(subject=user_b.id)


@pytest.fixture
def auth_headers_b(user_b_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_b_token}"}


@pytest.fixture
async def project_a(db_session: AsyncSession, user_a: User) -> Project:
    project = Project(
        name="Project Apollo",
        description="Apollo mission knowledge hub",
        created_by_id=user_a.id,
    )
    db_session.add(project)
    await db_session.flush()

    member = ProjectMember(
        project_id=project.id,
        user_id=user_a.id,
        role=ProjectRole.OWNER,
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(project)
    return project
