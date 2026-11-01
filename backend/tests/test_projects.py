import uuid

import pytest
from httpx import AsyncClient

from app.models.enums import ProjectRole


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers_a):
    payload = {
        "name": "Knowledge Hub Initiative",
        "description": "Evidence-linked handover project",
    }
    response = await client.post("/api/v1/projects/", json=payload, headers=auth_headers_a)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["description"] == payload["description"]
    assert data["my_role"] == ProjectRole.OWNER.value
    assert "id" in data


@pytest.mark.asyncio
async def test_list_my_projects(client: AsyncClient, auth_headers_a, auth_headers_b, project_a):
    # User A (owner of project_a) should see 1 project
    res_a = await client.get("/api/v1/projects/", headers=auth_headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert len(data_a) == 1
    assert data_a[0]["id"] == str(project_a.id)
    assert data_a[0]["my_role"] == ProjectRole.OWNER.value

    # User B (not member) should see 0 projects
    res_b = await client.get("/api/v1/projects/", headers=auth_headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert len(data_b) == 0


@pytest.mark.asyncio
async def test_get_project_detail_as_owner(client: AsyncClient, auth_headers_a, project_a, user_a):
    response = await client.get(f"/api/v1/projects/{project_a.id}", headers=auth_headers_a)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(project_a.id)
    assert data["name"] == project_a.name
    assert len(data["members"]) == 1
    assert data["members"][0]["user_id"] == str(user_a.id)
    assert data["members"][0]["role"] == ProjectRole.OWNER.value


@pytest.mark.asyncio
async def test_get_project_as_non_member(client: AsyncClient, auth_headers_b, project_a):
    # Non-member user B gets 403 Forbidden
    response = await client.get(f"/api/v1/projects/{project_a.id}", headers=auth_headers_b)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient, auth_headers_a):
    random_id = uuid.uuid4()
    response = await client.get(f"/api/v1/projects/{random_id}", headers=auth_headers_a)
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_update_project_as_owner(client: AsyncClient, auth_headers_a, project_a):
    payload = {"name": "Updated Apollo Project", "description": "Updated description"}
    response = await client.patch(
        f"/api/v1/projects/{project_a.id}", json=payload, headers=auth_headers_a
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Apollo Project"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_project_as_non_member(client: AsyncClient, auth_headers_b, project_a):
    payload = {"name": "Hacked Name"}
    response = await client.patch(
        f"/api/v1/projects/{project_a.id}", json=payload, headers=auth_headers_b
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_add_and_list_members(
    client: AsyncClient, auth_headers_a, auth_headers_b, project_a, user_b
):
    # 1. User A (owner) adds User B as MEMBER
    add_payload = {"email": user_b.email, "role": ProjectRole.MEMBER.value}
    res_add = await client.post(
        f"/api/v1/projects/{project_a.id}/members",
        json=add_payload,
        headers=auth_headers_a,
    )
    assert res_add.status_code == 201
    member_b_data = res_add.json()
    assert member_b_data["user_id"] == str(user_b.id)
    assert member_b_data["role"] == ProjectRole.MEMBER.value

    # 2. User B can now view the project
    res_view = await client.get(f"/api/v1/projects/{project_a.id}", headers=auth_headers_b)
    assert res_view.status_code == 200
    assert res_view.json()["my_role"] == ProjectRole.MEMBER.value

    # 3. List members
    res_members = await client.get(
        f"/api/v1/projects/{project_a.id}/members", headers=auth_headers_b
    )
    assert res_members.status_code == 200
    members = res_members.json()
    assert len(members) == 2


@pytest.mark.asyncio
async def test_add_member_validation_errors(client: AsyncClient, auth_headers_a, project_a, user_a):
    # Add non-existent user
    res_unknown = await client.post(
        f"/api/v1/projects/{project_a.id}/members",
        json={"email": "nobody@example.com", "role": ProjectRole.MEMBER.value},
        headers=auth_headers_a,
    )
    assert res_unknown.status_code == 404

    # Add existing member again
    res_duplicate = await client.post(
        f"/api/v1/projects/{project_a.id}/members",
        json={"email": user_a.email, "role": ProjectRole.MEMBER.value},
        headers=auth_headers_a,
    )
    assert res_duplicate.status_code == 409


@pytest.mark.asyncio
async def test_member_role_update_and_removal(
    client: AsyncClient, auth_headers_a, project_a, user_b
):
    # Add user B first
    res_add = await client.post(
        f"/api/v1/projects/{project_a.id}/members",
        json={"email": user_b.email, "role": ProjectRole.MEMBER.value},
        headers=auth_headers_a,
    )
    assert res_add.status_code == 201
    member_b_id = res_add.json()["id"]

    # Update role to REVIEWER
    res_update = await client.patch(
        f"/api/v1/projects/{project_a.id}/members/{member_b_id}",
        json={"role": ProjectRole.REVIEWER.value},
        headers=auth_headers_a,
    )
    assert res_update.status_code == 200
    assert res_update.json()["role"] == ProjectRole.REVIEWER.value

    # Remove user B
    res_delete = await client.delete(
        f"/api/v1/projects/{project_a.id}/members/{member_b_id}",
        headers=auth_headers_a,
    )
    assert res_delete.status_code == 204

    # Member list now has 1 member
    res_members = await client.get(
        f"/api/v1/projects/{project_a.id}/members", headers=auth_headers_a
    )
    assert len(res_members.json()) == 1


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient, auth_headers_a, auth_headers_b, project_a):
    # Non-owner cannot delete
    res_forbidden = await client.delete(f"/api/v1/projects/{project_a.id}", headers=auth_headers_b)
    assert res_forbidden.status_code == 403

    # Owner deletes
    res_delete = await client.delete(f"/api/v1/projects/{project_a.id}", headers=auth_headers_a)
    assert res_delete.status_code == 204

    # Project is gone
    res_get = await client.get(f"/api/v1/projects/{project_a.id}", headers=auth_headers_a)
    assert res_get.status_code == 404
