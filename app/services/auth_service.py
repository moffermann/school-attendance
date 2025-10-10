"""Authentication service."""

from datetime import datetime

from fastapi import HTTPException, status

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.db.repositories.users import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(self, session):
        self.session = session
        self.user_repo = UserRepository(session)

    async def _verify_user(self, email: str, password: str):
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password) or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
        return user

    async def authenticate(self, email: str, password: str) -> TokenPair:
        user = await self._verify_user(email, password)
        access_token = create_access_token(str(user.id), role=user.role, guardian_id=user.guardian_id)
        refresh_token = create_refresh_token(str(user.id))
        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    async def authenticate_user(self, email: str, password: str):
        return await self._verify_user(email, password)

    async def refresh(self, refresh_token: str) -> TokenPair:
        from app.core.security import decode_token

        payload = decode_token(refresh_token)
        user_id = payload.get("sub")
        user = await self.user_repo.get(int(user_id)) if user_id else None
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

        access_token = create_access_token(str(user.id), role=user.role, guardian_id=user.guardian_id)
        new_refresh = create_refresh_token(str(user.id))
        return TokenPair(access_token=access_token, refresh_token=new_refresh)
