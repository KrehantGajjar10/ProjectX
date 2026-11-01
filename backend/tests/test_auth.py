import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    payload = {
        "email": "newuser@example.com",
        "password": "SecurePassword123!",
        "full_name": "New User",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert data["is_active"] is True
    assert "password" not in data
    assert "hashed_password" not in data
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, user_a):
    payload = {
        "email": "alice@example.com",  # Already exists from fixture
        "password": "AnotherPassword123!",
        "full_name": "Alice Copycat",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_validation_failure(client: AsyncClient):
    # Password too short (< 8 chars)
    payload = {
        "email": "shortpw@example.com",
        "password": "short",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, user_a):
    payload = {
        "email": "alice@example.com",
        "password": "StrongPassword123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, user_a):
    payload = {
        "email": "alice@example.com",
        "password": "IncorrectPassword!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_login_non_existent_user(client: AsyncClient):
    payload = {
        "email": "ghost@example.com",
        "password": "StrongPassword123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, auth_headers_a, user_a):
    response = await client.get("/api/v1/auth/me", headers=auth_headers_a)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user_a.email
    assert data["full_name"] == user_a.full_name


@pytest.mark.asyncio
async def test_get_me_missing_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token_xyz"}
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"
