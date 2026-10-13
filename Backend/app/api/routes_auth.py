"""Authentication and user management API endpoints.

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import PyMongoError

from app.core.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.db.mongodb import get_database
from app.schemas.user import Token, UserCreate, UserLogin, UserOut

logger = logging.getLogger("fraudguard.routes_auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DB_UNAVAILABLE_DETAIL = "The database is currently unavailable. Please try again later."


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new compliance analyst or administrator",
)
async def register_user(user_in: UserCreate) -> UserOut:
    """Register a new user account with hashed password credentials."""
    try:
        db = get_database()
        existing_user = await db["users"].find_one({"email": user_in.email})
    except (PyMongoError, RuntimeError) as exc:
        logger.error("Database unavailable during user registration check: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=DB_UNAVAILABLE_DETAIL,
        )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    now_utc = datetime.now(timezone.utc)
    user_doc = {
        "email": user_in.email,
        "hashed_password": get_password_hash(user_in.password),
        "full_name": user_in.full_name,
        "role": "analyst",
        "created_at": now_utc,
    }

    try:
        result = await db["users"].insert_one(user_doc)
    except Exception as exc:
        if "duplicate" in str(exc).lower() or "e11000" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )
        if isinstance(exc, PyMongoError):
            logger.error("Database unavailable inserting user %s: %s", user_in.email, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=DB_UNAVAILABLE_DETAIL,
            )
        logger.error("Unexpected error inserting user document for %s: %s", user_in.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user due to an internal server error.",
        )

    user_doc["id"] = str(result.inserted_id)
    user_doc["_id"] = str(result.inserted_id)

    logger.info("New user registered: %s (id: %s)", user_in.email, user_doc["id"])
    return UserOut(**user_doc)


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate user and obtain JWT access token",
)
async def login_user(user_in: UserLogin) -> Token:
    """Authenticate email and password credentials, returning a signed JWT token."""
    try:
        db = get_database()
        user = await db["users"].find_one({"email": user_in.email})
    except (PyMongoError, RuntimeError) as exc:
        logger.error("Database unavailable during login for %s: %s", user_in.email, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=DB_UNAVAILABLE_DETAIL,
        )

    if not user or not verify_password(user_in.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user["email"], "user_id": str(user["_id"]), "role": user.get("role", "analyst")}
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post(
    "/token",
    response_model=Token,
    include_in_schema=False,
)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    """OAuth2 compatible token login for Swagger UI authorization."""
    try:
        db = get_database()
        user = await db["users"].find_one({"email": form_data.username})
    except (PyMongoError, RuntimeError) as exc:
        logger.error("Database unavailable during token login for %s: %s", form_data.username, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=DB_UNAVAILABLE_DETAIL,
        )

    if not user or not verify_password(form_data.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user["email"], "user_id": str(user["_id"]), "role": user.get("role", "analyst")}
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current authenticated user profile",
)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> UserOut:
    """Return profile details for the currently logged in analyst."""
    return UserOut(**current_user)
