import base64

import pytest
import respx

from app.integrations.connectors.github_connector import GitHubConnector
from app.integrations.github import (
    GitHubAuthError,
    GitHubClient,
    GitHubNotFoundError,
    GitHubRateLimitError,
)


@pytest.mark.asyncio
@respx.mock
async def test_github_fetch_all_success():
    # 1. Mock repo info
    respx.get("https://api.github.com/repos/octocat/Hello-World").respond(
        200,
        json={
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "default_branch": "main",
            "description": "My first repo",
        },
    )

    # 2. Mock README
    readme_text = "# Hello World\nWelcome to our repo."
    encoded_readme = base64.b64encode(readme_text.encode("utf-8")).decode("utf-8")
    respx.get("https://api.github.com/repos/octocat/Hello-World/readme?ref=main").respond(
        200,
        json={
            "name": "README.md",
            "path": "README.md",
            "sha": "readme123sha",
            "encoding": "base64",
            "content": encoded_readme,
        },
    )

    # 3. Mock git tree
    respx.get(
        "https://api.github.com/repos/octocat/Hello-World/git/trees/main?recursive=1"
    ).respond(
        200,
        json={
            "sha": "tree123",
            "tree": [
                {
                    "path": "src/index.py",
                    "mode": "100644",
                    "type": "blob",
                    "sha": "blob1",
                    "size": 50,
                },
                {
                    "path": "package-lock.json",
                    "mode": "100644",
                    "type": "blob",
                    "sha": "blob2",
                    "size": 100,
                },
                {
                    "path": "node_modules/lib.js",
                    "mode": "100644",
                    "type": "blob",
                    "sha": "blob3",
                    "size": 200,
                },
                {
                    "path": "assets/logo.png",
                    "mode": "100644",
                    "type": "blob",
                    "sha": "blob4",
                    "size": 500,
                },
            ],
        },
    )

    # 4. Mock file content for src/index.py
    respx.get(
        "https://api.github.com/repos/octocat/Hello-World/contents/src/index.py?ref=main"
    ).respond(200, text="print('Hello from index')")

    # 5. Mock commits
    respx.get("https://api.github.com/repos/octocat/Hello-World/commits?per_page=20").respond(
        200,
        json=[
            {
                "sha": "commit1sha",
                "commit": {
                    "author": {
                        "name": "Octocat",
                        "email": "octo@github.com",
                        "date": "2026-10-31T12:00:00Z",
                    },
                    "message": "Initial commit",
                },
            }
        ],
    )

    # 6. Mock issues
    respx.get(
        "https://api.github.com/repos/octocat/Hello-World/issues?state=all&per_page=30"
    ).respond(
        200,
        json=[
            {
                "id": 101,
                "number": 1,
                "title": "Bug in API",
                "body": "Fix this bug please",
                "state": "open",
                "user": {"login": "user1"},
                "html_url": "https://github.com/octocat/Hello-World/issues/1",
            }
        ],
    )

    connector = GitHubConnector(repo_url="https://github.com/octocat/Hello-World")
    is_valid = await connector.validate_connection()
    assert is_valid is True

    items = await connector.fetch_all()
    assert len(items) >= 4

    paths = [item.path for item in items]
    assert "metadata.json" in paths
    assert "README.md" in paths
    assert "src/index.py" in paths
    assert "package-lock.json" not in paths
    assert "node_modules/lib.js" not in paths
    assert "assets/logo.png" not in paths


@pytest.mark.asyncio
@respx.mock
async def test_github_rate_limit_error():
    respx.get("https://api.github.com/repos/octocat/Hello-World").respond(
        403,
        headers={"x-ratelimit-remaining": "0"},
        json={"message": "API rate limit exceeded"},
    )
    client = GitHubClient()
    with pytest.raises(GitHubRateLimitError):
        await client.get_repo_info("octocat", "Hello-World")


@pytest.mark.asyncio
@respx.mock
async def test_github_not_found_error():
    respx.get("https://api.github.com/repos/octocat/Ghost-Repo").respond(
        404,
        json={"message": "Not Found"},
    )
    client = GitHubClient()
    with pytest.raises(GitHubNotFoundError):
        await client.get_repo_info("octocat", "Ghost-Repo")


@pytest.mark.asyncio
@respx.mock
async def test_github_auth_error():
    respx.get("https://api.github.com/repos/octocat/Secret-Repo").respond(
        401,
        json={"message": "Bad credentials"},
    )
    client = GitHubClient()
    with pytest.raises(GitHubAuthError):
        await client.get_repo_info("octocat", "Secret-Repo")


def test_filter_relevant_files():
    client = GitHubClient()
    tree = [
        {"path": "package-lock.json", "type": "blob", "size": 100},
        {"path": "node_modules/pkg/index.js", "type": "blob", "size": 50},
        {"path": "image.png", "type": "blob", "size": 200},
        {"path": "docs/architecture.md", "type": "blob", "size": 300},
        {"path": "src/main.py", "type": "blob", "size": 400},
        {"path": "folder", "type": "tree"},  # directory
    ]
    filtered = client.filter_relevant_files(tree)
    paths = [f["path"] for f in filtered]
    assert paths == ["docs/architecture.md", "src/main.py"]
