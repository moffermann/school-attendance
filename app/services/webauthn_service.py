"""WebAuthn service for biometric authentication."""

import json
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    AuthenticatorAttachment,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
)

from app.core.config import settings
from app.db.models.student import Student
from app.db.models.user import User
from app.db.models.webauthn_credential import WebAuthnCredential
from app.db.repositories.webauthn import WebAuthnRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.users import UserRepository


# In-memory challenge store (for production, use Redis)
# Key: challenge_id (random), Value: {challenge: bytes, entity_type: str, entity_id: int, expires: datetime}
_challenge_store: dict[str, dict] = {}


def _cleanup_expired_challenges():
    """Remove expired challenges from the store."""
    # R2-B1 fix: Use timezone-aware datetime for consistent comparison
    now = datetime.now(timezone.utc)
    expired = []
    for k, v in _challenge_store.items():
        expires = v["expires"]
        # Handle both naive and aware datetimes for backwards compatibility
        if expires.tzinfo is None:
            # Treat naive datetime as UTC
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            expired.append(k)
    for k in expired:
        del _challenge_store[k]


class WebAuthnService:
    """
    Service for WebAuthn/Passkey operations.

    Supports two types of credentials:
    - Student credentials: for kiosk attendance (fingerprint/biometric)
    - User credentials: for web-app/teacher-pwa login (passkey)

    Uses discoverable credentials (resident keys) for usernameless authentication.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.credential_repo = WebAuthnRepository(session)
        self.student_repo = StudentRepository(session)
        self.user_repo = UserRepository(session)

    # =========================================================================
    # Student Registration (Kiosk Fingerprint Enrollment)
    # =========================================================================

    async def start_student_registration(
        self,
        student_id: int,
        device_name: str | None = None,
    ) -> dict:
        """
        Generate registration options for enrolling a student's biometric.

        Returns WebAuthn registration options to be passed to navigator.credentials.create()
        """
        student = await self.student_repo.get(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado"
            )

        # Check if student already has credentials
        existing = await self.credential_repo.list_by_student(student_id)

        # Generate a unique user handle (32 random bytes)
        user_handle = os.urandom(32)

        # Build excludeCredentials to prevent re-registration of same authenticator
        exclude_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=self._parse_transports(cred.transports),
            )
            for cred in existing
        ]

        options = generate_registration_options(
            rp_id=settings.webauthn_rp_id,
            rp_name=settings.webauthn_rp_name,
            user_id=user_handle,
            user_name=f"student_{student_id}",
            user_display_name=student.full_name,
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
                # Require resident key for usernameless authentication
                resident_key=ResidentKeyRequirement.REQUIRED,
                # Platform authenticator preferred (fingerprint/Face ID)
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            timeout=settings.webauthn_timeout_ms,
        )

        # Store challenge for verification
        challenge_id = secrets.token_urlsafe(32)
        _challenge_store[challenge_id] = {
            "challenge": options.challenge,
            "user_handle": user_handle,
            "entity_type": "student",
            "entity_id": student_id,
            "device_name": device_name,
            "expires": datetime.now(timezone.utc) + timedelta(milliseconds=settings.webauthn_timeout_ms),
        }

        _cleanup_expired_challenges()

        return {
            "challenge_id": challenge_id,
            "options": json.loads(options_to_json(options)),
        }

    async def complete_student_registration(
        self,
        challenge_id: str,
        credential_response: dict,
    ) -> WebAuthnCredential:
        """
        Verify and store a student's WebAuthn credential after registration.

        credential_response should be the JSON from navigator.credentials.create()
        """
        # Clean up expired challenges to prevent memory leak (B1 fix)
        _cleanup_expired_challenges()

        # Retrieve and validate challenge
        challenge_data = _challenge_store.pop(challenge_id, None)
        if not challenge_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge inválido o expirado"
            )

        if challenge_data["expires"] < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge expirado"
            )

        if challenge_data["entity_type"] != "student":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge no corresponde a registro de estudiante"
            )

        # Verify the registration response
        try:
            verification = verify_registration_response(
                credential=credential_response,
                expected_challenge=challenge_data["challenge"],
                expected_origin=settings.webauthn_rp_origin,
                expected_rp_id=settings.webauthn_rp_id,
                require_user_verification=True,
            )
        except Exception as e:
            # R10-S5 fix: Log internal error details, return generic message
            logger.error("WebAuthn student registration verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error verificando credencial"
            )

        # Extract transports if provided
        # R2-B2 fix: credential_response is a dict, use 'in' operator not hasattr
        transports = None
        if "response" in credential_response and "transports" in credential_response.get("response", {}):
            transports = ",".join(credential_response["response"].get("transports", []))

        # Create credential record
        credential = WebAuthnCredential(
            credential_id=bytes_to_base64url(verification.credential_id),
            student_id=challenge_data["entity_id"],
            user_id=None,
            user_handle=challenge_data["user_handle"],
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            transports=transports,
            device_name=challenge_data.get("device_name"),
            created_at=datetime.now(timezone.utc),
        )

        await self.credential_repo.create(credential)
        await self.session.commit()

        return credential

    # =========================================================================
    # Student Authentication (Kiosk Fingerprint Verification)
    # =========================================================================

    async def start_student_authentication(self) -> dict:
        """
        Generate authentication options for verifying a student's biometric.

        This is a "usernameless" flow - the authenticator will return the user_handle
        to identify which student is authenticating.
        """
        # Get all student credentials for allowCredentials
        # For discoverable credentials, we can leave this empty to allow any
        all_credentials = await self.credential_repo.get_all_student_credentials()

        allow_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=self._parse_transports(cred.transports),
            )
            for cred in all_credentials
        ] if all_credentials else None

        options = generate_authentication_options(
            rp_id=settings.webauthn_rp_id,
            # For discoverable credentials, allowCredentials can be empty
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=settings.webauthn_timeout_ms,
        )

        # Store challenge for verification
        challenge_id = secrets.token_urlsafe(32)
        _challenge_store[challenge_id] = {
            "challenge": options.challenge,
            "entity_type": "student_auth",
            "expires": datetime.now(timezone.utc) + timedelta(milliseconds=settings.webauthn_timeout_ms),
        }

        _cleanup_expired_challenges()

        return {
            "challenge_id": challenge_id,
            "options": json.loads(options_to_json(options)),
        }

    async def verify_student_authentication(
        self,
        challenge_id: str,
        credential_response: dict,
    ) -> Student:
        """
        Verify a student's WebAuthn authentication assertion.

        Returns the authenticated student if successful.
        """
        # Clean up expired challenges to prevent memory leak (B1 fix)
        _cleanup_expired_challenges()

        # Retrieve and validate challenge
        challenge_data = _challenge_store.pop(challenge_id, None)
        if not challenge_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge inválido o expirado"
            )

        if challenge_data["expires"] < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge expirado"
            )

        # Get credential ID from response
        credential_id = credential_response.get("id") or credential_response.get("rawId")
        if not credential_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="credential_id no proporcionado"
            )

        # Look up the credential
        credential = await self.credential_repo.get_by_credential_id(credential_id)
        if not credential or not credential.student_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credencial no reconocida"
            )

        # Verify the authentication response
        try:
            verification = verify_authentication_response(
                credential=credential_response,
                expected_challenge=challenge_data["challenge"],
                expected_origin=settings.webauthn_rp_origin,
                expected_rp_id=settings.webauthn_rp_id,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True,
            )
        except Exception as e:
            # R10-S5 fix: Log internal error details, return generic message
            logger.error("WebAuthn authentication verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Error verificando autenticación"
            )

        # Update sign count
        await self.credential_repo.update_sign_count(
            credential.credential_id,
            verification.new_sign_count
        )
        await self.session.commit()

        # Return the student with course eagerly loaded (avoid lazy loading issues)
        student = await self.student_repo.get_with_course(credential.student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado"
            )

        return student

    # =========================================================================
    # User Registration (Web-app/Teacher-pwa Passkey)
    # =========================================================================

    async def start_user_registration(
        self,
        user_id: int,
        device_name: str | None = None,
    ) -> dict:
        """Generate registration options for a user's passkey."""
        user = await self.user_repo.get(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )

        existing = await self.credential_repo.list_by_user(user_id)

        user_handle = os.urandom(32)

        exclude_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=self._parse_transports(cred.transports),
            )
            for cred in existing
        ]

        options = generate_registration_options(
            rp_id=settings.webauthn_rp_id,
            rp_name=settings.webauthn_rp_name,
            user_id=user_handle,
            user_name=user.email or f"user_{user_id}",
            user_display_name=user.full_name,
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.REQUIRED,
                # Cross-platform allowed for passkeys (security keys, phones)
                authenticator_attachment=AuthenticatorAttachment.CROSS_PLATFORM,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            timeout=settings.webauthn_timeout_ms,
        )

        challenge_id = secrets.token_urlsafe(32)
        _challenge_store[challenge_id] = {
            "challenge": options.challenge,
            "user_handle": user_handle,
            "entity_type": "user",
            "entity_id": user_id,
            "device_name": device_name,
            "expires": datetime.now(timezone.utc) + timedelta(milliseconds=settings.webauthn_timeout_ms),
        }

        _cleanup_expired_challenges()

        return {
            "challenge_id": challenge_id,
            "options": json.loads(options_to_json(options)),
        }

    async def complete_user_registration(
        self,
        challenge_id: str,
        credential_response: dict,
    ) -> WebAuthnCredential:
        """Verify and store a user's WebAuthn credential after registration."""
        # Clean up expired challenges to prevent memory leak (B1 fix)
        _cleanup_expired_challenges()

        challenge_data = _challenge_store.pop(challenge_id, None)
        if not challenge_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge inválido o expirado"
            )

        if challenge_data["expires"] < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge expirado"
            )

        if challenge_data["entity_type"] != "user":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge no corresponde a registro de usuario"
            )

        try:
            verification = verify_registration_response(
                credential=credential_response,
                expected_challenge=challenge_data["challenge"],
                expected_origin=settings.webauthn_rp_origin,
                expected_rp_id=settings.webauthn_rp_id,
                require_user_verification=True,
            )
        except Exception as e:
            # R10-S5 fix: Log internal error details, return generic message
            logger.error("WebAuthn user registration verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error verificando credencial"
            )

        transports = None
        if "response" in credential_response and "transports" in credential_response["response"]:
            transports = ",".join(credential_response["response"]["transports"])

        credential = WebAuthnCredential(
            credential_id=bytes_to_base64url(verification.credential_id),
            student_id=None,
            user_id=challenge_data["entity_id"],
            user_handle=challenge_data["user_handle"],
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            transports=transports,
            device_name=challenge_data.get("device_name"),
            created_at=datetime.now(timezone.utc),
        )

        await self.credential_repo.create(credential)
        await self.session.commit()

        return credential

    # =========================================================================
    # User Authentication (Web-app Passkey Login)
    # =========================================================================

    async def start_user_authentication(self) -> dict:
        """
        Generate authentication options for a user's passkey login.

        This is a "usernameless" flow - allows login with just biometric.
        """
        # Get all user credentials for allowCredentials
        all_credentials = await self.credential_repo.get_all_user_credentials()

        allow_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=self._parse_transports(cred.transports),
            )
            for cred in all_credentials
        ] if all_credentials else None

        options = generate_authentication_options(
            rp_id=settings.webauthn_rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=settings.webauthn_timeout_ms,
        )

        challenge_id = secrets.token_urlsafe(32)
        _challenge_store[challenge_id] = {
            "challenge": options.challenge,
            "entity_type": "user_auth",
            "expires": datetime.now(timezone.utc) + timedelta(milliseconds=settings.webauthn_timeout_ms),
        }

        _cleanup_expired_challenges()

        return {
            "challenge_id": challenge_id,
            "options": json.loads(options_to_json(options)),
        }

    async def verify_user_authentication(
        self,
        challenge_id: str,
        credential_response: dict,
    ) -> User:
        """
        Verify a user's WebAuthn authentication assertion.

        Returns the authenticated user if successful.
        """
        _cleanup_expired_challenges()

        challenge_data = _challenge_store.pop(challenge_id, None)
        if not challenge_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge inválido o expirado"
            )

        if challenge_data["expires"] < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge expirado"
            )

        if challenge_data["entity_type"] != "user_auth":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Challenge no corresponde a autenticación de usuario"
            )

        credential_id = credential_response.get("id") or credential_response.get("rawId")
        if not credential_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="credential_id no proporcionado"
            )

        credential = await self.credential_repo.get_by_credential_id(credential_id)
        if not credential or not credential.user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credencial no reconocida"
            )

        try:
            verification = verify_authentication_response(
                credential=credential_response,
                expected_challenge=challenge_data["challenge"],
                expected_origin=settings.webauthn_rp_origin,
                expected_rp_id=settings.webauthn_rp_id,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True,
            )
        except Exception as e:
            logger.error("WebAuthn user authentication verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Error verificando autenticación"
            )

        # Update sign count and last_used_at
        await self.credential_repo.update_sign_count(
            credential.credential_id,
            verification.new_sign_count
        )
        await self.session.commit()

        user = await self.user_repo.get(credential.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )

        return user

    # =========================================================================
    # Credential Management
    # =========================================================================

    async def list_student_credentials(self, student_id: int) -> list[dict]:
        """List all credentials for a student (for admin UI)."""
        credentials = await self.credential_repo.list_by_student(student_id)
        return [
            {
                "credential_id": cred.credential_id,
                "device_name": cred.device_name,
                "created_at": cred.created_at.isoformat(),
                "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
            }
            for cred in credentials
        ]

    async def list_user_credentials(self, user_id: int) -> list[dict]:
        """List all credentials for a user (for user profile)."""
        credentials = await self.credential_repo.list_by_user(user_id)
        return [
            {
                "credential_id": cred.credential_id,
                "device_name": cred.device_name,
                "created_at": cred.created_at.isoformat(),
                "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
            }
            for cred in credentials
        ]

    async def delete_credential(self, credential_id: str, user_id: int | None = None) -> bool:
        """
        Delete a credential by ID.

        If user_id is provided, verifies the credential belongs to that user.
        """
        credential = await self.credential_repo.get_by_credential_id(credential_id)
        if not credential:
            return False

        # If user_id specified, verify ownership
        if user_id is not None and credential.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para eliminar esta credencial"
            )

        await self.credential_repo.delete(credential_id)
        await self.session.commit()
        return True

    async def has_biometric(self, student_id: int) -> bool:
        """Check if a student has any registered biometric credentials."""
        return await self.credential_repo.exists_for_student(student_id)

    async def has_passkey(self, user_id: int) -> bool:
        """Check if a user has any registered passkey credentials."""
        return await self.credential_repo.exists_for_user(user_id)

    # =========================================================================
    # Helpers
    # =========================================================================

    def _parse_transports(self, transports_str: str | None) -> list[AuthenticatorTransport]:
        """Parse comma-separated transports string into list of AuthenticatorTransport."""
        if not transports_str:
            return []

        transport_map = {
            "usb": AuthenticatorTransport.USB,
            "nfc": AuthenticatorTransport.NFC,
            "ble": AuthenticatorTransport.BLE,
            "internal": AuthenticatorTransport.INTERNAL,
            "hybrid": AuthenticatorTransport.HYBRID,
        }

        result = []
        for t in transports_str.split(","):
            t = t.strip().lower()
            if t in transport_map:
                result.append(transport_map[t])

        return result
