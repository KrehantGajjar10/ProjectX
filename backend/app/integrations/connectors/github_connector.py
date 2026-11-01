import json

import httpx

from app.integrations.base import BaseConnector, FetchedItem
from app.integrations.github import GitHubClient


class GitHubConnector(BaseConnector):
    """Connector that fetches content and metadata from a GitHub repository."""

    def __init__(
        self,
        repo_url: str,
        branch: str | None = None,
        access_token: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.repo_url = repo_url
        self.owner, self.repo = GitHubClient.parse_repo_url(repo_url)
        self.branch = branch
        self.client = GitHubClient(
            access_token=access_token,
            transport=transport,
        )

    async def validate_connection(self) -> bool:
        repo_info = await self.client.get_repo_info(self.owner, self.repo)
        return bool(repo_info and repo_info.get("name"))

    async def fetch_all(self) -> list[FetchedItem]:
        items: list[FetchedItem] = []

        # 1. Fetch repo info
        repo_info = await self.client.get_repo_info(self.owner, self.repo)
        target_branch = self.branch or repo_info.get("default_branch", "main")

        # Add repo metadata item
        items.append(
            FetchedItem(
                id=f"{self.owner}/{self.repo}/metadata.json",
                title=f"Repository Metadata: {self.owner}/{self.repo}",
                path="metadata.json",
                content=json.dumps(repo_info, indent=2),
                mime_type="application/json",
                item_type="metadata",
                metadata={"owner": self.owner, "repo": self.repo, "default_branch": target_branch},
            )
        )

        # 2. Fetch README
        readme = await self.client.get_readme(self.owner, self.repo, ref=target_branch)
        if readme and readme.get("decoded_content"):
            readme_path = readme.get("path", "README.md")
            items.append(
                FetchedItem(
                    id=f"{self.owner}/{self.repo}/{readme_path}",
                    title=f"README ({readme_path})",
                    path=readme_path,
                    content=readme["decoded_content"],
                    mime_type="text/markdown",
                    item_type="document",
                    metadata={"branch": target_branch, "sha": readme.get("sha")},
                )
            )

        # 3. Fetch directory tree and relevant files
        tree = await self.client.get_tree(self.owner, self.repo, branch=target_branch)
        relevant_files = self.client.filter_relevant_files(tree)

        for entry in relevant_files:
            file_path = entry.get("path", "")
            # Skip readme if already added
            if readme and file_path == readme.get("path"):
                continue

            try:
                content = await self.client.get_file_content(
                    self.owner, self.repo, file_path, ref=target_branch
                )
                items.append(
                    FetchedItem(
                        id=f"{self.owner}/{self.repo}/{file_path}",
                        title=file_path.split("/")[-1],
                        path=file_path,
                        content=content,
                        mime_type="text/plain",
                        item_type="file",
                        metadata={
                            "branch": target_branch,
                            "sha": entry.get("sha"),
                            "size": entry.get("size"),
                        },
                    )
                )
            except Exception:
                # Silently skip files that fail individual fetch (e.g., deleted or submodules)
                continue

        # 4. Fetch recent commits
        commits = await self.client.get_recent_commits(self.owner, self.repo, limit=20)
        if commits:
            commits_summary = "\n\n".join(
                f"Commit {c['sha'][:8]} by {c['author']} ({c['date']}):\n{c['message']}"
                for c in commits
            )
            items.append(
                FetchedItem(
                    id=f"{self.owner}/{self.repo}/commits.txt",
                    title="Recent Commit History",
                    path="commits.txt",
                    content=commits_summary,
                    mime_type="text/plain",
                    item_type="commit_history",
                    metadata={"count": len(commits)},
                )
            )

        # 5. Fetch issues and pull requests
        issues_and_prs = await self.client.get_issues_and_prs(self.owner, self.repo, limit=30)
        if issues_and_prs:
            prs = [i for i in issues_and_prs if i["is_pr"]]
            issues = [i for i in issues_and_prs if not i["is_pr"]]

            if prs:
                prs_text = "\n\n---\n\n".join(
                    f"PR #{p['number']} ({p['state']}) by {p['author']}: {p['title']}\n{p['body']}"
                    for p in prs
                )
                items.append(
                    FetchedItem(
                        id=f"{self.owner}/{self.repo}/pull_requests.md",
                        title="Pull Requests",
                        path="pull_requests.md",
                        content=prs_text,
                        mime_type="text/markdown",
                        item_type="pull_requests",
                        metadata={"count": len(prs)},
                    )
                )

            if issues:
                issues_text = "\n\n---\n\n".join(
                    f"Issue #{i['number']} ({i['state']}) by {i['author']}: {i['title']}\n{i['body']}"
                    for i in issues
                )
                items.append(
                    FetchedItem(
                        id=f"{self.owner}/{self.repo}/issues.md",
                        title="Issues",
                        path="issues.md",
                        content=issues_text,
                        mime_type="text/markdown",
                        item_type="issues",
                        metadata={"count": len(issues)},
                    )
                )

        return items
