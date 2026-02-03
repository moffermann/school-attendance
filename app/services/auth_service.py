"""Authentication service."""

from fastapi import HTTPException, status

from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_tenant_access_token,
    create_tenant_refresh_token,
    verify_password,
)
from app.db.repositories.users import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(self, session, tenant_id: int | None = None, tenant_slug: str | None = None):
        self.session = session
        self.user_repo = UserRepository(session)
        # BUG-MT-001 fix: Store tenant context for token generation
        self.tenant_id = tenant_id
        self.tenant_slug = tenant_slug

    async def _verify_user(self, email: str, password: str):
        # TDD-BUG4.3 fix: Normalize email to lowercase for case-insensitive lookup
        normalized_email = email.lower()
        user = await self.user_repo.get_by_email(normalized_email)
        if not user or not verify_password(password, user.hashed_password) or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
            )
        return user

    async def authenticate(self, email: str, password: str) -> TokenPair:
        # TDD-BUG4.3 fix: Email normalization is done in _verify_user
        user = await self._verify_user(email, password)

        # BUG-MT-001 fix: Generate tenant-aware tokens when tenant context is available
        if self.tenant_id and self.tenant_slug:
            access_token = create_tenant_access_token(
                user_id=user.id,
                tenant_id=self.tenant_id,
                tenant_slug=self.tenant_slug,
                role=user.role,
                guardian_id=user.guardian_id,
            )
            refresh_token = create_tenant_refresh_token(
                user_id=user.id,
                tenant_id=self.tenant_id,
            )
        else:
            # Fallback for backwards compatibility (non-tenant contexts)
            access_token = create_access_token(
                str(user.id), role=user.role, guardian_id=user.guardian_id
            )
            refresh_token = create_refresh_token(str(user.id))

        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    async def authenticate_user(self, email: str, password: str):
        return await self._verify_user(email, password)

    async def refresh(self, refresh_token: str) -> TokenPair:
        from app.core.security import decode_token
        from app.core.token_blacklist import token_blacklist

        payload = decode_token(refresh_token)
        user_id = payload.get("sub")
        user = await self.user_repo.get(int(user_id)) if user_id else None
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

        # R17-AUTH2 fix: Invalidate old refresh token on rotation to prevent reuse
        # This prevents an attacker from using a stolen refresh token after rotation
        exp = payload.get("exp")
        token_blacklist.add(refresh_token, exp)

        # BUG-MT-001 fix: Extract tenant_id from refresh token if present,
        # otherwise use the tenant context from the service
        token_tenant_id = payload.get("tenant_id") or self.tenant_id
        tenant_slug = self.tenant_slug

        if token_tenant_id and tenant_slug:
            access_token = create_tenant_access_token(
                user_id=user.id,
                tenant_id=token_tenant_id,
                tenant_slug=tenant_slug,
                role=user.role,
                guardian_id=user.guardian_id,
            )
            new_refresh = create_tenant_refresh_token(
                user_id=user.id,
                tenant_id=token_tenant_id,
            )
        else:
            access_token = create_access_token(
                str(user.id), role=user.role, guardian_id=user.guardian_id
            )
            new_refresh = create_refresh_token(str(user.id))

        return TokenPair(access_token=access_token, refresh_token=new_refresh)
