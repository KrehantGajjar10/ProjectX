from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.core.config import settings


class Neo4jClient:
    """Optional Neo4j client for knowledge graph queries. Does not write to relational DB."""

    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
        enabled: bool | None = None,
    ) -> None:
        self.enabled = enabled if enabled is not None else settings.NEO4J_ENABLED
        self.uri = uri or settings.NEO4J_URI
        self.user = user or settings.NEO4J_USER
        self.password = password or settings.NEO4J_PASSWORD
        self._driver: AsyncDriver | None = None

    @property
    def driver(self) -> AsyncDriver:
        if not self.enabled:
            raise RuntimeError("Neo4j integration is disabled by configuration.")
        if self._driver is None:
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
            )
        return self._driver

    async def execute_query(
        self, query: str, parameters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        if not self.enabled:
            return []
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def close(self) -> None:
        if self._driver:
            await self._driver.close()
