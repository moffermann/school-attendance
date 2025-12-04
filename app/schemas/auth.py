"""Authentication schemas."""

from enum import Enum

from pydantic import BaseModel, EmailStr, Field


# R8-V2 fix: Define valid user roles
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    DIRECTOR = "DIRECTOR"
    INSPECTOR = "INSPECTOR"
    TEACHER = "TEACHER"
    PARENT = "PARENT"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    # R8-V1 fix: Use EmailStr for email validation
    email: EmailStr
    # R13-SEC1 fix: Require min 8 chars for password security
    password: str = Field(..., min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SessionUser(BaseModel):
    id: int
    full_name: str
    # R8-V2 fix: Use UserRole enum for role validation
    role: UserRole
    guardian_id: int | None = None


class SessionResponse(BaseModel):
    access_token: str
    user: SessionUser
