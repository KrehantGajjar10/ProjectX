from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user
from app.core.exceptions import AuthenticationError
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserRead
from app.services import auth_service

router = APIRouter()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.register_user(db, user_in)


@router.post(
    "/login",
    response_model=Token,
    summary="User login with email and password",
)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Token:
    user = await auth_service.authenticate_user(
        db, email=login_data.email, password=login_data.password
    )
    if not user:
        raise AuthenticationError(message="Incorrect email or password.")
    if not user.is_active:
        raise AuthenticationError(message="Account is inactive.")

    access_token = create_access_token(subject=user.id)
    return Token(access_token=access_token, token_type="bearer")


@router.post(
    "/login/access-token",
    response_model=Token,
    include_in_schema=False,
    summary="OAuth2 compatible token login for docs",
)
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    user = await auth_service.authenticate_user(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise AuthenticationError(message="Incorrect email or password.")
    if not user.is_active:
        raise AuthenticationError(message="Account is inactive.")

    access_token = create_access_token(subject=user.id)
    return Token(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current authenticated user",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> User:
    return current_user
