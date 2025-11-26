"""Authentication schemas."""

from pydantic import BaseModel


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SessionUser(BaseModel):
    id: int
    full_name: str
    role: str
    guardian_id: int | None = None


class SessionResponse(BaseModel):
    access_token: str
    user: SessionUser
