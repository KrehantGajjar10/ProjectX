from typing import Any

import httpx

from app.core.config import settings


class GitHubClient:
    """Client for GitHub API integrations. Does not access database."""

    def __init__(self, access_token: str | None = None) -> None:
        self.token = access_token or settings.GITHUB_ACCESS_TOKEN
        self.base_url = "https://api.github.com"

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "ProjectX-Backend",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_repo_info(self, owner: str, repo: str) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            response = await client.get(f"/repos/{owner}/{repo}", headers=self._get_headers())
            response.raise_for_status()
            return response.json()

    async def get_repo_tree(self, owner: str, repo: str, branch: str = "main") -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=60.0) as client:
            response = await client.get(
                f"/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.json()

    async def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> bytes:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            response = await client.get(
                f"/repos/{owner}/{repo}/contents/{path}?ref={ref}",
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.content
