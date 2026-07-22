"""
Authentication service
"""

from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import get_settings
from models.user import User
from models.refresh_token import RefreshToken
from models.device import Device

settings = get_settings()

# Password hashing with Argon2id
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create an access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token() -> str:
    """Create a refresh token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    """Authenticate a user by username and password."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


async def create_user(db: AsyncSession, username: str, password: str, is_admin: bool = False) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        password_hash=hashed_password,
        is_admin=is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """Get a user by username."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_refresh_token_record(
    db: AsyncSession,
    user_id: str,
    device_id: Optional[str] = None,
    expires_days: int = 7
) -> tuple[str, RefreshToken]:
    """Create a refresh token record and return the token and record."""
    token = create_refresh_token()
    token_hash = hash_token(token)

    refresh_token = RefreshToken(
        user_id=user_id,
        device_id=device_id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
    )
    db.add(refresh_token)
    await db.commit()
    await db.refresh(refresh_token)

    return token, refresh_token


async def verify_refresh_token(db: AsyncSession, token: str) -> Optional[RefreshToken]:
    """Verify a refresh token and return the record."""
    token_hash = hash_token(token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token_id: str) -> None:
    """Revoke a refresh token."""
    result = await db.execute(select(RefreshToken).where(RefreshToken.id == token_id))
    token = result.scalar_one_or_none()

    if token:
        token.revoked_at = datetime.utcnow()
        await db.commit()


async def revoke_all_user_tokens(db: AsyncSession, user_id: str) -> None:
    """Revoke all refresh tokens for a user."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    tokens = result.scalars().all()

    for token in tokens:
        token.revoked_at = datetime.utcnow()

    await db.commit()


async def register_device(
    db: AsyncSession,
    user_id: str,
    name: str,
    platform: str,
    app_version: str,
    device_fingerprint: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Device:
    """Register a new device."""
    device = Device(
        user_id=user_id,
        name=name,
        platform=platform,
        app_version=app_version,
        device_fingerprint=device_fingerprint,
        last_ip=ip_address,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def get_device_by_id(db: AsyncSession, device_id: str) -> Optional[Device]:
    """Get a device by ID."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    return result.scalar_one_or_none()


async def get_user_devices(db: AsyncSession, user_id: str) -> list[Device]:
    """Get all devices for a user."""
    result = await db.execute(select(Device).where(Device.user_id == user_id))
    return list(result.scalars().all())


async def update_device_sync_time(db: AsyncSession, device_id: str) -> None:
    """Update the last sync time for a device."""
    device = await get_device_by_id(db, device_id)
    if device:
        device.last_sync_at = datetime.utcnow()
        await db.commit()
