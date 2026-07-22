"""
Authentication API endpoints
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token_record,
    verify_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
    verify_token,
    get_user_by_id,
    register_device,
    get_user_devices,
)
from models.user import User

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# Request/Response models
class LoginRequest(BaseModel):
    username: str
    password: str
    device_name: Optional[str] = "Unknown Device"
    platform: Optional[str] = "unknown"
    app_version: Optional[str] = "0.0.0"


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfoResponse(BaseModel):
    id: str
    username: str
    is_admin: bool
    created_at: str


class DeviceInfo(BaseModel):
    id: str
    name: str
    platform: str
    app_version: str
    last_sync_at: Optional[str]
    created_at: str


class ErrorResponse(BaseModel):
    code: str
    message: str


# Dependencies
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise credentials_exception

    return user


# Endpoints
@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return tokens."""
    # Authenticate user
    user = await authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Register device
    device = await register_device(
        db=db,
        user_id=str(user.id),
        name=request.device_name,
        platform=request.platform,
        app_version=request.app_version,
    )

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token, _ = await create_refresh_token_record(
        db=db,
        user_id=str(user.id),
        device_id=str(device.id),
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        username=user.username,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    # Verify refresh token
    token_record = await verify_refresh_token(db, request.refresh_token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user
    user = await get_user_by_id(db, str(token_record.user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Create new access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return RefreshResponse(access_token=access_token)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout current user and revoke tokens."""
    await revoke_all_user_tokens(db, str(current_user.id))
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserInfoResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Get current user information."""
    return UserInfoResponse(
        id=str(current_user.id),
        username=current_user.username,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at.isoformat(),
    )


@router.get("/devices", response_model=list[DeviceInfo])
async def get_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all devices for the current user."""
    devices = await get_user_devices(db, str(current_user.id))

    return [
        DeviceInfo(
            id=str(device.id),
            name=device.name,
            platform=device.platform,
            app_version=device.app_version,
            last_sync_at=device.last_sync_at.isoformat() if device.last_sync_at else None,
            created_at=device.created_at.isoformat(),
        )
        for device in devices
    ]
