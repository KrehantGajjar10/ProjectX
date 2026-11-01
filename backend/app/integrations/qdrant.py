import logging
import uuid
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import settings

logger = logging.getLogger(__name__)

SENTINEL_METADATA_ID = "00000000-0000-0000-0000-000000000000"


class QdrantStore:
    """Client for Qdrant vector database.

    Strict rules:
    - Dedicated to vector indexing and search operations.
    - NEVER writes directly to the relational database.
    - ALL searches MUST filter by project_id to enforce multi-tenant isolation.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        api_key: str | None = None,
        collection_name: str | None = None,
    ) -> None:
        self.host = host or settings.QDRANT_HOST
        self.port = port or settings.QDRANT_PORT
        self.api_key = api_key or settings.QDRANT_API_KEY
        self.default_collection = collection_name or settings.QDRANT_COLLECTION_NAME
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
        collection_name: str | None = None,
        vector_size: int | None = None,
        distance: qmodels.Distance = qmodels.Distance.COSINE,
    ) -> None:
        """Ensures the collection exists with vector size, cosine distance, payload indexes, and metadata."""
        col = collection_name or self.default_collection
        dim = vector_size or settings.GEMINI_EMBEDDING_DIMENSION

        collections = await self.client.get_collections()
        exists = any(c.name == col for c in collections.collections)

        if not exists:
            logger.info("Creating Qdrant collection '%s' with dimension %d", col, dim)
            await self.client.create_collection(
                collection_name=col,
                vectors_config=qmodels.VectorParams(
                    size=dim,
                    distance=distance,
                ),
            )

            # Create payload field indexes for rapid filtered retrieval
            index_fields = [
                ("project_id", qmodels.PayloadSchemaType.KEYWORD),
                ("document_id", qmodels.PayloadSchemaType.KEYWORD),
                ("chunk_id", qmodels.PayloadSchemaType.KEYWORD),
                ("source_id", qmodels.PayloadSchemaType.KEYWORD),
                ("category", qmodels.PayloadSchemaType.KEYWORD),
                ("entity_type", qmodels.PayloadSchemaType.KEYWORD),
                ("verified", qmodels.PayloadSchemaType.BOOL),
            ]
            for field_name, schema_type in index_fields:
                try:
                    await self.client.create_payload_index(
                        collection_name=col,
                        field_name=field_name,
                        field_schema=schema_type,
                    )
                except Exception as exc:
                    logger.debug("Index for '%s' might already exist: %s", field_name, exc)

            # Store index metadata sentinel point
            await self.set_index_metadata(
                model_name=settings.GEMINI_EMBEDDING_MODEL,
                dimension=dim,
                collection_name=col,
            )

    async def get_index_metadata(self, collection_name: str | None = None) -> dict[str, Any] | None:
        """Retrieves stored embedding model and dimension metadata from the sentinel point."""
        col = collection_name or self.default_collection
        try:
            points = await self.client.retrieve(
                collection_name=col,
                ids=[SENTINEL_METADATA_ID],
                with_payload=True,
            )
            if points and points[0].payload:
                return dict(points[0].payload)
        except Exception as exc:
            logger.debug("Could not retrieve index metadata sentinel: %s", exc)
        return None

    async def set_index_metadata(
        self,
        model_name: str,
        dimension: int,
        collection_name: str | None = None,
    ) -> None:
        """Stores or updates the index metadata sentinel point."""
        col = collection_name or self.default_collection
        sentinel_vector = [0.0] * dimension
        await self.client.upsert(
            collection_name=col,
            points=[
                qmodels.PointStruct(
                    id=SENTINEL_METADATA_ID,
                    vector=sentinel_vector,
                    payload={
                        "entity_type": "index_metadata",
                        "model_name": model_name,
                        "dimension": dimension,
                    },
                )
            ],
        )

    async def verify_or_init_collection(
        self,
        collection_name: str | None = None,
        force_recreate: bool = False,
    ) -> None:
        """Verifies collection dimension and model name against current Settings.

        If a mismatch is detected, raises ValueError requiring a re-index.
        """
        col = collection_name or self.default_collection
        dim = settings.GEMINI_EMBEDDING_DIMENSION
        model = settings.GEMINI_EMBEDDING_MODEL

        collections = await self.client.get_collections()
        exists = any(c.name == col for c in collections.collections)

        if not exists:
            await self.ensure_collection(collection_name=col, vector_size=dim)
            return

        if force_recreate:
            logger.warning("Force recreating Qdrant collection '%s'", col)
            await self.client.delete_collection(col)
            await self.ensure_collection(collection_name=col, vector_size=dim)
            return

        col_info = await self.client.get_collection(col)
        existing_dim = None
        if col_info.config and col_info.config.params and col_info.config.params.vectors:
            vectors_param = col_info.config.params.vectors
            if isinstance(vectors_param, qmodels.VectorParams):
                existing_dim = vectors_param.size

        if existing_dim is not None and existing_dim != dim:
            raise ValueError(
                f"Vector dimension mismatch in collection '{col}': collection has {existing_dim}, "
                f"but configuration specifies {dim}. A reindex is required."
            )

        metadata = await self.get_index_metadata(collection_name=col)
        if metadata:
            stored_model = metadata.get("model_name")
            if stored_model and stored_model != model:
                raise ValueError(
                    f"Embedding model mismatch in collection '{col}': index was built with '{stored_model}', "
                    f"but configuration specifies '{model}'. A reindex is required."
                )
        else:
            # Metadata point was missing; set it now
            await self.set_index_metadata(model_name=model, dimension=dim, collection_name=col)

    async def upsert_points(
        self,
        points: list[qmodels.PointStruct],
        collection_name: str | None = None,
    ) -> Any:
        col = collection_name or self.default_collection
        return await self.client.upsert(
            collection_name=col,
            points=points,
        )

    async def search(
        self,
        project_id: uuid.UUID,
        query_vector: list[float],
        limit: int = 10,
        category: str | None = None,
        source_id: uuid.UUID | None = None,
        document_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        verified_only: bool = False,
        collection_name: str | None = None,
    ) -> list[qmodels.ScoredPoint]:
        """Performs semantic vector search with strict project isolation.

        ALL searches must filter by project_id so projects never leak into each other.
        """
        col = collection_name or self.default_collection

        # Mandatory project_id isolation filter
        must_conditions: list[qmodels.Condition] = [
            qmodels.FieldCondition(
                key="project_id",
                match=qmodels.MatchValue(value=str(project_id)),
            )
        ]

        if category:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="category",
                    match=qmodels.MatchValue(value=category),
                )
            )
        if source_id:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="source_id",
                    match=qmodels.MatchValue(value=str(source_id)),
                )
            )
        if document_id:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="document_id",
                    match=qmodels.MatchValue(value=str(document_id)),
                )
            )
        if entity_type:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="entity_type",
                    match=qmodels.MatchValue(value=entity_type),
                )
            )
        if verified_only:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="verified",
                    match=qmodels.MatchValue(value=True),
                )
            )

        # Exclude sentinel metadata point
        must_not_conditions: list[qmodels.Condition] = [
            qmodels.FieldCondition(
                key="entity_type",
                match=qmodels.MatchValue(value="index_metadata"),
            )
        ]

        query_filter = qmodels.Filter(
            must=must_conditions,
            must_not=must_not_conditions,
        )

        res = await self.client.query_points(
            collection_name=col,
            query=query_vector,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        )
        return res.points

    async def delete_by_document(
        self,
        project_id: uuid.UUID,
        document_id: uuid.UUID,
        collection_name: str | None = None,
    ) -> None:
        col = collection_name or self.default_collection
        flt = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="project_id", match=qmodels.MatchValue(value=str(project_id))
                ),
                qmodels.FieldCondition(
                    key="document_id", match=qmodels.MatchValue(value=str(document_id))
                ),
            ]
        )
        await self.client.delete(
            collection_name=col,
            points_selector=qmodels.FilterSelector(filter=flt),
        )

    async def delete_by_chunk_ids(
        self,
        project_id: uuid.UUID,
        chunk_ids: list[uuid.UUID],
        collection_name: str | None = None,
    ) -> None:
        col = collection_name or self.default_collection
        if not chunk_ids:
            return
        id_strs = [str(cid) for cid in chunk_ids]
        flt = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="project_id", match=qmodels.MatchValue(value=str(project_id))
                ),
                qmodels.FieldCondition(key="chunk_id", match=qmodels.MatchAny(any=id_strs)),
            ]
        )
        await self.client.delete(
            collection_name=col,
            points_selector=qmodels.FilterSelector(filter=flt),
        )

    async def delete_by_project(
        self,
        project_id: uuid.UUID,
        collection_name: str | None = None,
    ) -> None:
        col = collection_name or self.default_collection
        flt = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="project_id", match=qmodels.MatchValue(value=str(project_id))
                ),
            ]
        )
        await self.client.delete(
            collection_name=col,
            points_selector=qmodels.FilterSelector(filter=flt),
        )

    async def count_points(
        self,
        project_id: uuid.UUID | None = None,
        collection_name: str | None = None,
    ) -> int:
        col = collection_name or self.default_collection
        count_filter = None
        if project_id:
            count_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="project_id", match=qmodels.MatchValue(value=str(project_id))
                    ),
                ],
                must_not=[
                    qmodels.FieldCondition(
                        key="entity_type", match=qmodels.MatchValue(value="index_metadata")
                    ),
                ],
            )
        res = await self.client.count(collection_name=col, count_filter=count_filter)
        return res.count

    async def close(self) -> None:
        if self._client:
            await self._client.close()


_global_qdrant_store: QdrantStore | None = None


def get_qdrant_store() -> QdrantStore:
    global _global_qdrant_store
    if _global_qdrant_store is None:
        _global_qdrant_store = QdrantStore()
    return _global_qdrant_store
