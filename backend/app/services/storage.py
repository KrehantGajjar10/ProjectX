import os
from pathlib import Path
from typing import Protocol

from app.core.config import settings


class StorageBackend(Protocol):
    async def save_file(self, relative_path: str, content: bytes) -> str:
        """Saves content to the given relative path and returns the resolved storage path."""
        ...

    async def read_file(self, relative_path: str) -> bytes:
        """Reads file bytes from storage."""
        ...

    async def delete_file(self, relative_path: str) -> bool:
        """Deletes a file from storage. Returns True if deleted, False if not found."""
        ...

    async def exists(self, relative_path: str) -> bool:
        """Checks if a file exists in storage."""
        ...


class LocalStorageBackend:
    """Local filesystem storage implementation."""

    def __init__(self, base_dir: str | Path | None = None) -> None:
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, relative_path: str) -> Path:
        # Prevent directory traversal attacks
        clean_rel = os.path.normpath(relative_path).lstrip(os.sep)
        target = (self.base_dir / clean_rel).resolve()
        if not str(target).startswith(str(self.base_dir)):
            raise ValueError(f"Path traversal detected: {relative_path}")
        return target

    async def save_file(self, relative_path: str, content: bytes) -> str:
        target = self._resolve_safe_path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Synchronous file write is fast for local storage chunks
        target.write_bytes(content)
        return str(target)

    async def read_file(self, relative_path: str) -> bytes:
        target = self._resolve_safe_path(relative_path)
        if not target.is_file():
            raise FileNotFoundError(f"File not found in storage: {relative_path}")
        return target.read_bytes()

    async def delete_file(self, relative_path: str) -> bool:
        target = self._resolve_safe_path(relative_path)
        if target.is_file():
            target.unlink()
            return True
        return False

    async def exists(self, relative_path: str) -> bool:
        target = self._resolve_safe_path(relative_path)
        return target.is_file()


_default_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _default_storage
    if _default_storage is None:
        _default_storage = LocalStorageBackend()
    return _default_storage
