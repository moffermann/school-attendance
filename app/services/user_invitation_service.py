"""Service for user invitations and password resets."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import hash_password
from app.db.repositories.user_invitations import UserInvitationRepository
from app.db.repositories.users import UserRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.db.models.user import User
    from app.db.models.user_invitation import UserInvitation

logger = logging.getLogger(__name__)

INVITATION_EXPIRES_HOURS = 48
PASSWORD_RESET_EXPIRES_HOURS = 1


class UserInvitationService:
    def __init__(
        self,
        session: "AsyncSession",
        user_repo: UserRepository,
        invitation_repo: UserInvitationRepository,
        *,
        tenant_id: int | None = None,
        tenant_schema: str | None = None,
    ):
        self.session = session
        self.user_repo = user_repo
        self.invitation_repo = invitation_repo
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema

    async def send_invitation(self, user_id: int, email: str) -> None:
        """Generate invitation token, store hash, and queue email."""
        # Invalidate any pending invitations for this user
        await self.invitation_repo.invalidate_pending(user_id, "INVITATION")

        # Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRES_HOURS)

        # Store in DB
        await self.invitation_repo.create(
            user_id=user_id,
            email=email,
            token_hash=token_hash,
            purpose="INVITATION",
            expires_at=expires_at,
        )

        # Queue email
        base_url = str(settings.public_base_url).rstrip("/")
        activation_url = f"{base_url}/app/#/parent-setup?token={token}"
        await self._queue_email(
            email,
            "parent_invitation",
            {"activation_url": activation_url, "expires_hours": INVITATION_EXPIRES_HOURS},
        )

    async def send_password_reset(self, email: str) -> None:
        """Generate password reset token and queue email. Silent if user not found."""
        user = await self.user_repo.get_by_email(email.lower())
        if not user:
            # Don't reveal whether the email exists
            return

        # Invalidate pending resets
        await self.invitation_repo.invalidate_pending(user.id, "PASSWORD_RESET")

        # Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=PASSWORD_RESET_EXPIRES_HOURS)

        # Store in DB
        await self.invitation_repo.create(
            user_id=user.id,
            email=user.email,
            token_hash=token_hash,
            purpose="PASSWORD_RESET",
            expires_at=expires_at,
        )
        await self.session.commit()

        # Queue email
        base_url = str(settings.public_base_url).rstrip("/")
        reset_url = f"{base_url}/app/#/reset-password?token={token}"
        await self._queue_email(
            user.email,
            "password_reset",
            {"reset_url": reset_url},
        )

    async def validate_token(self, token: str, purpose: str) -> "UserInvitation | None":
        """Validate token: hash match + not used + not expired + correct purpose."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        invitation = await self.invitation_repo.get_by_token_hash(token_hash)

        if not invitation:
            return None
        if invitation.used_at is not None:
            return None
        if invitation.expires_at < datetime.now(timezone.utc):
            return None
        if invitation.purpose != purpose:
            return None

        return invitation

    async def complete_setup(self, token: str, password: str) -> "User":
        """Complete parent account setup: set password and activate user."""
        invitation = await self.validate_token(token, "INVITATION")
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de invitación inválido o expirado",
            )

        user = await self.user_repo.get(invitation.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        # Set password and activate
        user.hashed_password = hash_password(password)
        user.is_active = True

        # Mark invitation as used
        await self.invitation_repo.mark_used(invitation.id)
        await self.session.commit()

        return user

    async def reset_password(self, token: str, new_password: str) -> "User":
        """Reset user password using a valid reset token."""
        invitation = await self.validate_token(token, "PASSWORD_RESET")
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de recuperación inválido o expirado",
            )

        user = await self.user_repo.get(invitation.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        # Update password
        user.hashed_password = hash_password(new_password)

        # Mark token as used
        await self.invitation_repo.mark_used(invitation.id)
        await self.session.commit()

        return user

    async def _queue_email(self, to: str, template: str, variables: dict) -> None:
        """Queue an email for sending via RQ."""
        from redis import Redis
        from rq import Queue

        try:
            redis_conn = Redis.from_url(settings.redis_url)
            queue = Queue("notifications", connection=redis_conn)

            queue.enqueue(
                "app.workers.jobs.send_email.send_email_message",
                None,  # notification_id
                to,
                template,
                variables,
                self.tenant_id,
                self.tenant_schema,
            )
            logger.info(f"Queued {template} email for: {to}")
        except Exception as e:
            logger.error(f"Failed to queue {template} email: {e}")
