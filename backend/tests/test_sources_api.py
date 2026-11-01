import pytest
import respx
from httpx import AsyncClient


@pytest.mark.asyncio
@respx.mock
async def test_connect_github_source_api(client: AsyncClient, auth_headers_a, project_a):
    respx.get("https://api.github.com/repos/google/gemini-cookbook").respond(
        200,
        json={
            "name": "gemini-cookbook",
            "full_name": "google/gemini-cookbook",
            "default_branch": "main",
        },
    )

    payload = {
        "repo_url": "https://github.com/google/gemini-cookbook",
        "branch": "main",
        "name": "Gemini Cookbook",
    }
    response = await client.post(
        f"/api/v1/projects/{project_a.id}/sources/github",
        json=payload,
        headers=auth_headers_a,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Gemini Cookbook"
    assert data["type"] == "github"
    assert data["config"]["repo_url"] == payload["repo_url"]


@pytest.mark.asyncio
async def test_upload_documents_api(client: AsyncClient, auth_headers_a, project_a):
    files = [
        ("files", ("handover.md", b"# Handover Document\nKey knowledge points.", "text/markdown")),
        ("files", ("notes.txt", b"Deployment notes on port 8000.", "text/plain")),
    ]
    response = await client.post(
        f"/api/v1/projects/{project_a.id}/sources/upload",
        files=files,
        headers=auth_headers_a,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["source"]["type"] == "upload"
    assert len(data["files"]) == 2
    assert data["files"][0]["filename"] == "handover.md"
    assert data["files"][1]["filename"] == "notes.txt"


@pytest.mark.asyncio
async def test_upload_invalid_extension_rejected(client: AsyncClient, auth_headers_a, project_a):
    files = [
        ("files", ("malware.exe", b"binarycontent", "application/octet-stream")),
    ]
    response = await client.post(
        f"/api/v1/projects/{project_a.id}/sources/upload",
        files=files,
        headers=auth_headers_a,
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "BAD_REQUEST"
    assert "invalid extension" in data["error"]["message"].lower()


@pytest.mark.asyncio
async def test_list_and_delete_sources_api(
    client: AsyncClient, auth_headers_a, auth_headers_b, project_a
):
    # Upload a document to create a source
    files = [
        ("files", ("doc.md", b"# Markdown content", "text/markdown")),
    ]
    res_upload = await client.post(
        f"/api/v1/projects/{project_a.id}/sources/upload",
        files=files,
        headers=auth_headers_a,
    )
    assert res_upload.status_code == 201
    source_id = res_upload.json()["source"]["id"]

    # List sources as member
    res_list = await client.get(
        f"/api/v1/projects/{project_a.id}/sources",
        headers=auth_headers_a,
    )
    assert res_list.status_code == 200
    sources = res_list.json()
    assert len(sources) == 1
    assert sources[0]["id"] == source_id

    # Non-member cannot view sources (403 Forbidden)
    res_forbidden = await client.get(
        f"/api/v1/projects/{project_a.id}/sources",
        headers=auth_headers_b,
    )
    assert res_forbidden.status_code == 403

    # Delete source
    res_del = await client.delete(
        f"/api/v1/projects/{project_a.id}/sources/{source_id}",
        headers=auth_headers_a,
    )
    assert res_del.status_code == 204

    # Verify source is gone
    res_list_after = await client.get(
        f"/api/v1/projects/{project_a.id}/sources",
        headers=auth_headers_a,
    )
    assert len(res_list_after.json()) == 0


@pytest.mark.asyncio
async def test_ingestion_jobs_api(client: AsyncClient, auth_headers_a, project_a):
    # 1. Enqueue job
    payload = {"source_ids": None}
    res_create = await client.post(
        f"/api/v1/projects/{project_a.id}/ingestion/jobs",
        json=payload,
        headers=auth_headers_a,
    )
    assert res_create.status_code == 201
    job_data = res_create.json()
    assert job_data["status"] == "queued"
    assert job_data["progress"] == 0
    job_id = job_data["id"]

    # 2. Get job status
    res_get = await client.get(
        f"/api/v1/projects/{project_a.id}/ingestion/jobs/{job_id}",
        headers=auth_headers_a,
    )
    assert res_get.status_code == 200
    assert res_get.json()["id"] == job_id

    # 3. List jobs
    res_list = await client.get(
        f"/api/v1/projects/{project_a.id}/ingestion/jobs",
        headers=auth_headers_a,
    )
    assert res_list.status_code == 200
    jobs = res_list.json()
    assert len(jobs) >= 1
    assert any(j["id"] == job_id for j in jobs)
