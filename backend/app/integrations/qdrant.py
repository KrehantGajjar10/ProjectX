from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import settings


class QdrantStore:
    """Client for Qdrant vector database. Does not write to relational database."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        api_key: str | None = None,
    ) -> None:
        self.host = host or settings.QDRANT_HOST
        self.port = port or settings.QDRANT_PORT
        self.api_key = api_key or settings.QDRANT_API_KEY
        self._client: AsyncQdrantClient | None = None

    @property
    def client(self) -> AsyncQdrantClient:
        if self._client is None:
            self._client = AsyncQdrantClient(
                host=self.host,
                port=self.port,
                api_key=self.api_key if self.api_key else None,
            )
        return self._client

    async def ensure_collection(
        self,
        collection_name: str,
        vector_size: int = 768,
        distance: qmodels.Distance = qmodels.Distance.COSINE,
    ) -> None:
        collections = await self.client.get_collections()
        exists = any(c.name == collection_name for c in collections.collections)
        if not exists:
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=qmodels.VectorParams(
                    size=vector_size,
                    distance=distance,
                ),
            )

    async def upsert_points(
        self,
        collection_name: str,
        points: list[qmodels.PointStruct],
    ) -> Any:
        return await self.client.upsert(
            collection_name=collection_name,
            points=points,
        )

    async def search(
        self,
        collection_name: str,
        query_vector: list[float],
        limit: int = 5,
        query_filter: qmodels.Filter | None = None,
    ) -> list[Any]:
        return await self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit,
            query_filter=query_filter,
        )

    async def close(self) -> None:
        if self._client:
            await self._client.close()
