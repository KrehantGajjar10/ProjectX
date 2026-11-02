from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Core settings
    PROJECT_NAME: str = "ProjectX Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    DEMO_MODE: bool = False
    API_V1_STR: str = "/api/v1"

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_EXPENSIVE_PER_MINUTE: int = 15

    # Security & Auth
    SECRET_KEY: str = "projectx-secret-key-change-in-production-min-32-bytes"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "projectx"
    POSTGRES_PASSWORD: str = "projectx_secret"
    POSTGRES_DB: str = "projectx"
    DATABASE_URL: str | None = None
    TEST_DATABASE_URL: str | None = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: float = 30.0
    DB_POOL_PRE_PING: bool = True

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Qdrant
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION_NAME: str = "projectx_knowledge"

    # Neo4j (Optional)
    NEO4J_ENABLED: bool = False
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "projectx_secret"

    # Gemini
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TEMPERATURE: float = 0.1
    GEMINI_TIMEOUT_SECONDS: float = 60.0
    GEMINI_MAX_RETRIES: int = 3
    GEMINI_CONCURRENCY_LIMIT: int = 5
    EXTRACTION_BATCH_SIZE: int = 5
    EXTRACTION_VERSION: str = "v1.0"

    # Gemini Embeddings & Retrieval
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    GEMINI_EMBEDDING_DIMENSION: int = 768
    EMBEDDING_BATCH_SIZE: int = 20
    EMBEDDING_CONCURRENCY_LIMIT: int = 5
    RETRIEVAL_TOP_K: int = 10
    RETRIEVAL_HYBRID_ALPHA: float = 0.5

    # GitHub
    GITHUB_ACCESS_TOKEN: str | None = None

    # Storage & Uploads
    STORAGE_DIR: str = "data/storage"
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    ALLOWED_UPLOAD_EXTENSIONS: list[str] = [
        ".pdf",
        ".md",
        ".markdown",
        ".docx",
        ".pptx",
        ".txt",
        ".py",
        ".ts",
        ".js",
        ".json",
        ".yaml",
        ".yml",
    ]

    # Ingestion & Chunking
    CHUNK_SIZE_TOKENS: int = 800
    CHUNK_OVERLAP_TOKENS: int = 150
    INGESTION_WORKER_POLL_INTERVAL_SECONDS: float = 2.0
    INGESTION_STUCK_TIMEOUT_SECONDS: int = 900  # 15 minutes
    GITHUB_MAX_FILE_SIZE_BYTES: int = 1024 * 1024  # 1 MB
    GITHUB_MAX_FILES: int = 500

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            import json

            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed]
            except Exception:
                pass
        return v

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = str(self.DATABASE_URL)
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def async_test_database_url(self) -> str:
        if self.TEST_DATABASE_URL:
            url = str(self.TEST_DATABASE_URL)
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}_test"
        )


settings = Settings()
