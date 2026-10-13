"""Authentication, password hashing, JWT token management, and security dependencies.

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.db.mongodb import get_database

logger = logging.getLogger("fraudguard.security")

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for extracting Bearer tokens from Authorization headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a raw password string against its stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Compute secure bcrypt hash for a plaintext password."""
    return pwd_context.hash(password)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate a signed JWT access token containing arbitrary payload data."""
    settings = get_settings()
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a signed JWT access token.

    Raises
    ------
    HTTPException
        If the token is expired, has an invalid signature, or is malformed.
    """
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise credentials_exception


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Dependency that authenticates the user from the incoming Bearer token.

    Decodes the JWT token, extracts the subject (email or user_id), and fetches
    the active user record from MongoDB.

    Returns
    -------
    dict
        User profile document from MongoDB with stringified `_id` and `id`.

    Raises
    ------
    HTTPException
        401 Unauthorized if token is invalid or user does not exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    email: Optional[str] = payload.get("sub") or payload.get("email")
    user_id: Optional[str] = payload.get("user_id") or payload.get("id")

    if not email and not user_id:
        raise credentials_exception

    try:
        db = get_database()
        user = None
        if email:
            user = await db["users"].find_one({"email": email})
        elif user_id and ObjectId.is_valid(user_id):
            user = await db["users"].find_one({"_id": ObjectId(user_id)})

        if user is None:
            raise credentials_exception

        # Normalize MongoDB identifier
        user["id"] = str(user["_id"])
        user["_id"] = str(user["_id"])
        return user

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error retrieving user during authentication: %s", exc)
        raise credentials_exception


async def get_current_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Dependency restricting endpoint access strictly to users with 'admin' role."""
    role = current_user.get("role", "").lower()
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to perform this action",
        )
    return current_user
