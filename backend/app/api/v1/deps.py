import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, AuthorizationError, NotFoundError
from app.db.session import get_db
from app.models.enums import ProjectRole, has_minimum_role
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.services import auth_service, project_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        token_sub = payload.get("sub")
        if not token_sub:
            raise AuthenticationError(message="Invalid token payload.")
        user_id = uuid.UUID(token_sub)
    except (jwt.PyJWTError, ValueError):
        raise AuthenticationError(message="Could not validate credentials.") from None

    user = await auth_service.get_user_by_id(db, user_id)
    if not user:
        raise AuthenticationError(message="User not found.")
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise AuthenticationError(message="Inactive user account.")
    return current_user


def require_project_role(
    min_role: ProjectRole = ProjectRole.VIEWER,
) -> Callable:
    """
    Reusable dependency ensuring that:
    1. The project exists (otherwise 404).
    2. The current user is a member of the project (otherwise 403).
    3. The member's role meets or exceeds min_role in the hierarchy (otherwise 403).
    Returns a tuple of (Project, ProjectMember).
    """

    async def _role_verifier(
        project_id: uuid.UUID,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> tuple[Project, ProjectMember]:
        project = await project_service.get_project_by_id(db, project_id)
        if not project:
            raise NotFoundError(message="Project not found.")

        member = await project_service.get_project_member(db, project_id, current_user.id)
        if not member:
            raise AuthorizationError(message="You are not a member of this project.")

        if not has_minimum_role(member.role, min_role):
            raise AuthorizationError(
                message=(
                    f"Insufficient permissions. Required role: {min_role.value}, "
                    f"your role: {member.role.value}."
                )
            )

        return project, member

    return _role_verifier
