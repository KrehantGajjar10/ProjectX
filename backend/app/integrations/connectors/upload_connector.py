from typing import Any

from app.integrations.base import BaseConnector, FetchedItem
from app.services.storage import StorageBackend, get_storage


class UploadConnector(BaseConnector):
    """Connector for uploaded documents stored via the storage abstraction."""

    def __init__(
        self,
        files_config: list[dict[str, Any]],
        storage: StorageBackend | None = None,
    ) -> None:
        self.files_config = files_config
        self.storage = storage or get_storage()

    async def validate_connection(self) -> bool:
        # Check if at least one file exists in storage
        if not self.files_config:
            return True
        first_storage_path = self.files_config[0].get("storage_path", "")
        return await self.storage.exists(first_storage_path)

    async def fetch_all(self) -> list[FetchedItem]:
        items: list[FetchedItem] = []

        for f in self.files_config:
            storage_path = f.get("storage_path", "")
            filename = f.get("filename", storage_path.split("/")[-1])
            mime_type = f.get("mime_type", "application/octet-stream")

            try:
                content = await self.storage.read_file(storage_path)
                items.append(
                    FetchedItem(
                        id=storage_path,
                        title=filename,
                        path=filename,
                        content=content,
                        mime_type=mime_type,
                        item_type="upload",
                        metadata={
                            "storage_path": storage_path,
                            "original_name": filename,
                            "size": f.get("size", len(content)),
                        },
                    )
                )
            except FileNotFoundError:
                continue

        return items
