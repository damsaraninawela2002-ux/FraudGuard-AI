"""Pydantic schemas for User authentication, registration, and profiles.

FraudGuard AI – Explainable Fraud Detection System
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Schema for registering a new user."""

    email: EmailStr = Field(..., description="Unique email address for account login")
    password: str = Field(
        ...,
        min_length=8,
        description="User password (minimum 8 characters required)",
    )
    full_name: str = Field(..., min_length=1, description="Full name of the user/analyst")


class UserLogin(BaseModel):
    """Schema for authenticating an existing user."""

    email: EmailStr = Field(..., description="Account email address")
    password: str = Field(..., description="Account password")


class UserOut(BaseModel):
    """Public user profile schema (never exposes sensitive password hashes)."""

    id: str = Field(..., alias="_id", description="Unique database identifier for the user")
    email: EmailStr = Field(..., description="User email address")
    full_name: str = Field(..., description="User full name")
    role: str = Field(default="analyst", description="Assigned role: analyst, investigator, or admin")
    created_at: datetime = Field(..., description="Account creation timestamp")

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("id", mode="before")
    @classmethod
    def convert_id(cls, v: Any) -> str:
        """Ensure MongoDB ObjectId is serialized as a string."""
        return str(v)


class Token(BaseModel):
    """OAuth2 Bearer token response schema."""

    access_token: str = Field(..., description="Signed JWT access token")
    token_type: str = Field(default="bearer", description="Token authentication type")
