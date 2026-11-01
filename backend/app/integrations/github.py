import base64
import re
from typing import Any

import httpx

from app.core.config import settings


class GitHubError(Exception):
    """Base exception for GitHub integration errors."""


class GitHubAuthError(GitHubError):
    """Raised when GitHub token is missing, invalid, or unauthorized."""


class GitHubNotFoundError(GitHubError):
    """Raised when the repository or resource is not found."""


class GitHubRateLimitError(GitHubError):
    """Raised when GitHub API rate limits are exceeded."""


class GitHubClient:
    """Async HTTPX-based client for GitHub API.

    Only fetches data from GitHub; NEVER accesses or writes to the database.
    """

    # Lockfiles to exclude from source ingestion
    EXCLUDED_LOCKFILES = {
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "poetry.lock",
        "uv.lock",
        "cargo.lock",
        "composer.lock",
        "gemfile.lock",
        "go.sum",
        "pipfile.lock",
    }

    # Directories to completely skip
    EXCLUDED_DIRECTORIES = {
        "node_modules",
        "vendor",
        ".git",
        ".github",
        ".venv",
        "venv",
        "env",
        "dist",
        "build",
        "target",
        "__pycache__",
        ".next",
        ".nuxt",
        ".idea",
        ".vscode",
        ".coverage",
        ".pytest_cache",
        ".ruff_cache",
    }

    # Binary/asset extensions to exclude
    EXCLUDED_EXTENSIONS = {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".svg",
        ".webp",
        ".bmp",
        ".tiff",
        ".mp3",
        ".mp4",
        ".wav",
        ".avi",
        ".mov",
        ".zip",
        ".tar",
        ".gz",
        ".tgz",
        ".bz2",
        ".xz",
        ".7z",
        ".rar",
        ".exe",
        ".bin",
        ".dll",
        ".so",
        ".dylib",
        ".o",
        ".a",
        ".pyc",
        ".pyo",
        ".pyd",
        ".class",
        ".jar",
        ".war",
        ".ear",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".map",
    }

    def __init__(
        self,
        access_token: str | None = None,
        timeout: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.token = access_token or settings.GITHUB_ACCESS_TOKEN
        self.base_url = "https://api.github.com"
        self.timeout = timeout
        self.transport = transport

    @staticmethod
    def parse_repo_url(url: str) -> tuple[str, str]:
        """Extracts (owner, repo) from GitHub URL or 'owner/repo' string."""
        clean = url.strip().rstrip("/")
        if clean.endswith(".git"):
            clean = clean[:-4]

        # Match https://github.com/owner/repo or git@github.com:owner/repo
        match = re.search(r"github\.com[:/]([^/]+)/([^/]+)$", clean)
        if match:
            return match.group(1), match.group(2)

        # Match 'owner/repo'
        parts = clean.split("/")
        if len(parts) == 2 and parts[0] and parts[1]:
            return parts[0], parts[1]

        raise ValueError(
            f"Invalid GitHub repository URL: '{url}'. Expected format 'owner/repo' or 'https://github.com/owner/repo'."
        )

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "ProjectX-Backend",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _handle_response_errors(self, response: httpx.Response) -> None:
        if response.status_code == 401 or (
            response.status_code == 403 and "bad credentials" in response.text.lower()
        ):
            raise GitHubAuthError("Invalid, expired, or missing GitHub credentials.")
        elif response.status_code == 403 and (
            "rate limit" in response.text.lower()
            or response.headers.get("x-ratelimit-remaining") == "0"
        ):
            raise GitHubRateLimitError("GitHub API rate limit exceeded.")
        elif response.status_code == 404:
            raise GitHubNotFoundError(
                "GitHub repository or resource not found, or token lacks access."
            )
        elif response.status_code >= 400:
            raise GitHubError(f"GitHub API error ({response.status_code}): {response.text}")

    async def get_repo_info(self, owner: str, repo: str) -> dict[str, Any]:
        """Fetches repository metadata."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            resp = await client.get(f"/repos/{owner}/{repo}", headers=self._get_headers())
            self._handle_response_errors(resp)
            return resp.json()

    async def get_readme(
        self, owner: str, repo: str, ref: str | None = None
    ) -> dict[str, Any] | None:
        """Fetches the decoded repository README if available."""
        url = f"/repos/{owner}/{repo}/readme"
        if ref:
            url += f"?ref={ref}"
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            resp = await client.get(url, headers=self._get_headers())
            if resp.status_code == 404:
                return None
            self._handle_response_errors(resp)
            data = resp.json()
            content_encoded = data.get("content", "")
            if content_encoded and data.get("encoding") == "base64":
                try:
                    data["decoded_content"] = base64.b64decode(content_encoded).decode(
                        "utf-8", errors="replace"
                    )
                except Exception:
                    data["decoded_content"] = ""
            return data

    async def get_tree(self, owner: str, repo: str, branch: str = "main") -> list[dict[str, Any]]:
        """Fetches the recursive git tree for a given branch or commit SHA."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout * 2,
            transport=self.transport,
        ) as client:
            resp = await client.get(
                f"/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                headers=self._get_headers(),
            )
            self._handle_response_errors(resp)
            data = resp.json()
            return data.get("tree", [])

    def filter_relevant_files(self, tree_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Filters tree entries to relevant source and doc files, skipping binaries and lockfiles."""
        relevant: list[dict[str, Any]] = []

        for entry in tree_entries:
            if entry.get("type") != "blob":
                continue

            path = entry.get("path", "")
            lower_path = path.lower()
            filename = lower_path.split("/")[-1]

            # 1. Skip lockfiles
            if filename in self.EXCLUDED_LOCKFILES:
                continue

            # 2. Skip excluded directories
            path_parts = lower_path.split("/")[:-1]
            if any(part in self.EXCLUDED_DIRECTORIES for part in path_parts):
                continue

            # 3. Skip binary and asset extensions
            if any(lower_path.endswith(ext) for ext in self.EXCLUDED_EXTENSIONS):
                continue

            # 4. Check file size if reported
            size = entry.get("size")
            if size is not None and size > settings.GITHUB_MAX_FILE_SIZE_BYTES:
                continue

            relevant.append(entry)
            if len(relevant) >= settings.GITHUB_MAX_FILES:
                break

        return relevant

    async def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> str:
        """Fetches raw text content of a file."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            headers = self._get_headers()
            headers["Accept"] = "application/vnd.github.v3.raw"
            resp = await client.get(
                f"/repos/{owner}/{repo}/contents/{path}?ref={ref}",
                headers=headers,
            )
            self._handle_response_errors(resp)
            return resp.text

    async def get_recent_commits(
        self, owner: str, repo: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        """Fetches recent commit history."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            resp = await client.get(
                f"/repos/{owner}/{repo}/commits?per_page={limit}",
                headers=self._get_headers(),
            )
            self._handle_response_errors(resp)
            commits = resp.json()
            results = []
            for c in commits:
                results.append(
                    {
                        "sha": c.get("sha", ""),
                        "author": (c.get("commit", {}).get("author", {}).get("name", "")),
                        "email": (c.get("commit", {}).get("author", {}).get("email", "")),
                        "date": (c.get("commit", {}).get("author", {}).get("date", "")),
                        "message": c.get("commit", {}).get("message", ""),
                    }
                )
            return results

    async def get_issues_and_prs(
        self, owner: str, repo: str, limit: int = 30
    ) -> list[dict[str, Any]]:
        """Fetches issues and pull requests when permissions allow."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            try:
                resp = await client.get(
                    f"/repos/{owner}/{repo}/issues?state=all&per_page={limit}",
                    headers=self._get_headers(),
                )
                if resp.status_code in (403, 404, 410):
                    # Issues may be disabled or token lacks scope; fail open with empty list
                    return []
                self._handle_response_errors(resp)
                items = resp.json()
                results = []
                for item in items:
                    is_pr = "pull_request" in item
                    results.append(
                        {
                            "id": item.get("id"),
                            "number": item.get("number"),
                            "title": item.get("title", ""),
                            "body": item.get("body", "") or "",
                            "state": item.get("state", "open"),
                            "is_pr": is_pr,
                            "author": item.get("user", {}).get("login", ""),
                            "created_at": item.get("created_at"),
                            "url": item.get("html_url", ""),
                        }
                    )
                return results
            except (GitHubError, httpx.HTTPError):
                return []
