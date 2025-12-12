"""WebAuthn/Passkey authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.core.rate_limiter import limiter
from app.services.feature_flag_service import FEATURE_WEBAUTHN
from app.db.repositories.teachers import TeacherRepository
from app.schemas.webauthn import (
    BiometricStatusResponse,
    CompleteRegistrationRequest,
    CredentialListResponse,
    CredentialResponse,
    DeleteCredentialResponse,
    KioskAuthenticationResult,
    KioskStudentRegistrationRequest,
    StartAuthenticationResponse,
    StartRegistrationRequest,
    StartRegistrationResponse,
    StudentAuthenticationResponse,
    VerifyAuthenticationRequest,
)
from app.services.webauthn_service import WebAuthnService


router = APIRouter()


# =============================================================================
# Kiosk Endpoints (Device-authenticated)
# =============================================================================


@router.post(
    "/kiosk/students/register/start",
    response_model=StartRegistrationResponse,
    summary="Iniciar registro biométrico de estudiante desde kiosk",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def kiosk_start_student_registration(
    request: KioskStudentRegistrationRequest,
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Inicia el proceso de registro biométrico para un estudiante desde el kiosk.

    Requiere autenticación del dispositivo (X-Device-Key header).
    El profesor que inicia el registro debe tener permiso can_enroll_biometric.

    Retorna las opciones WebAuthn para pasar a navigator.credentials.create()
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    result = await webauthn_service.start_student_registration(
        student_id=request.student_id,
        device_name=request.device_name,
    )

    return StartRegistrationResponse(
        challenge_id=result["challenge_id"],
        options=result["options"],
    )


@router.post(
    "/kiosk/students/register/complete",
    response_model=CredentialResponse,
    summary="Completar registro biométrico de estudiante",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def kiosk_complete_student_registration(
    request: CompleteRegistrationRequest,
    device_authenticated: bool = Depends(deps.verify_device_key),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Completa el registro biométrico de un estudiante.

    Recibe la respuesta de navigator.credentials.create() y verifica la credencial.
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    credential = await webauthn_service.complete_student_registration(
        challenge_id=request.challenge_id,
        credential_response=request.credential,
    )

    return CredentialResponse(
        credential_id=credential.credential_id,
        device_name=credential.device_name,
        created_at=credential.created_at,
    )


@router.post(
    "/kiosk/authenticate/start",
    response_model=StartAuthenticationResponse,
    summary="Iniciar autenticación biométrica en kiosk",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def kiosk_start_authentication(
    device_authenticated: bool = Depends(deps.verify_device_key),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Inicia el proceso de autenticación biométrica para identificar un estudiante.

    Este es un flujo "usernameless" - el estudiante solo presenta su huella
    y el sistema identifica quién es basándose en la credencial registrada.

    Retorna las opciones WebAuthn para pasar a navigator.credentials.get()
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    result = await webauthn_service.start_student_authentication()

    return StartAuthenticationResponse(
        challenge_id=result["challenge_id"],
        options=result["options"],
    )


@router.post(
    "/kiosk/authenticate/verify",
    response_model=KioskAuthenticationResult,
    summary="Verificar autenticación biométrica",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def kiosk_verify_authentication(
    request: VerifyAuthenticationRequest,
    device_authenticated: bool = Depends(deps.verify_device_key),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Verifica la autenticación biométrica y retorna los datos del estudiante.

    Recibe la respuesta de navigator.credentials.get() y verifica la firma.
    Si es válida, retorna la información del estudiante para continuar
    con el flujo de registro de asistencia.
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    student = await webauthn_service.verify_student_authentication(
        challenge_id=request.challenge_id,
        credential_response=request.credential,
    )

    return KioskAuthenticationResult(
        student_id=student.id,
        full_name=student.full_name,
        rut=student.rut,
        course_name=student.course.name if student.course else None,
        photo_url=student.photo_ref,
        has_photo_consent=student.photo_pref_opt_in,
    )


@router.get(
    "/kiosk/students/{student_id}/biometric-status",
    response_model=BiometricStatusResponse,
    summary="Verificar si estudiante tiene biometría registrada",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def kiosk_check_biometric_status(
    # R10-A6 fix: Validate student_id with ge=1
    student_id: int = Path(..., ge=1),
    device_authenticated: bool = Depends(deps.verify_device_key),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Verifica si un estudiante tiene credenciales biométricas registradas.

    Útil para el kiosk para saber si mostrar la opción de huella digital
    o si ofrecer el registro.
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    credentials = await webauthn_service.list_student_credentials(student_id)

    return BiometricStatusResponse(
        has_biometric=len(credentials) > 0,
        credential_count=len(credentials),
    )


# =============================================================================
# Admin Endpoints (Role-authenticated)
# =============================================================================


@router.post(
    "/admin/students/{student_id}/register/start",
    response_model=StartRegistrationResponse,
    summary="Iniciar registro biométrico desde panel de administración",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def admin_start_student_registration(
    # TDD-R6-BUG1 fix: Validate student_id path parameter
    student_id: int = Path(..., ge=1),
    request: StartRegistrationRequest = None,
    current_user: AuthUser = Depends(deps.require_roles("DIRECTOR", "INSPECTOR")),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Inicia el registro biométrico de un estudiante desde el panel de administración.

    Solo disponible para directores e inspectores.
    """
    result = await webauthn_service.start_student_registration(
        student_id=student_id,
        device_name=request.device_name,
    )

    return StartRegistrationResponse(
        challenge_id=result["challenge_id"],
        options=result["options"],
    )


@router.post(
    "/admin/students/{student_id}/register/complete",
    response_model=CredentialResponse,
    summary="Completar registro biométrico desde panel de administración",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def admin_complete_student_registration(
    # TDD-R6-BUG1 fix: Validate student_id path parameter
    student_id: int = Path(..., ge=1),
    request: CompleteRegistrationRequest = None,
    current_user: AuthUser = Depends(deps.require_roles("DIRECTOR", "INSPECTOR")),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Completa el registro biométrico de un estudiante desde el panel de administración.
    """
    credential = await webauthn_service.complete_student_registration(
        challenge_id=request.challenge_id,
        credential_response=request.credential,
    )

    return CredentialResponse(
        credential_id=credential.credential_id,
        device_name=credential.device_name,
        created_at=credential.created_at,
    )


@router.get(
    "/admin/students/{student_id}/credentials",
    response_model=CredentialListResponse,
    summary="Listar credenciales de un estudiante",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def admin_list_student_credentials(
    # TDD-R6-BUG1 fix: Validate student_id path parameter
    student_id: int = Path(..., ge=1),
    current_user: AuthUser = Depends(deps.require_roles("DIRECTOR", "INSPECTOR")),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Lista todas las credenciales biométricas registradas para un estudiante.
    """
    credentials = await webauthn_service.list_student_credentials(student_id)

    return CredentialListResponse(
        credentials=credentials,
        count=len(credentials),
    )


@router.delete(
    "/admin/students/{student_id}/credentials/{credential_id}",
    response_model=DeleteCredentialResponse,
    summary="Eliminar credencial de estudiante",
    dependencies=[Depends(deps.require_feature(FEATURE_WEBAUTHN))],
)
async def admin_delete_student_credential(
    student_id: int = Path(..., ge=1),
    # R10-A5 fix: Validate credential_id format
    credential_id: str = Path(..., min_length=1, max_length=512),
    current_user: AuthUser = Depends(deps.require_roles("DIRECTOR", "INSPECTOR")),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Elimina una credencial biométrica de un estudiante.

    Solo directores e inspectores pueden eliminar credenciales.
    """
    # R17-AUDIT2 fix: Log admin credential deletion for security audit
    logger.info(
        f"Admin credential deletion: user_id={current_user.id} "
        f"student_id={student_id} credential_id={credential_id[:8]}..."
    )

    deleted = await webauthn_service.delete_credential(credential_id)

    if not deleted:
        logger.warning(
            f"Admin credential deletion failed: not found - user_id={current_user.id} "
            f"student_id={student_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credencial no encontrada"
        )

    return DeleteCredentialResponse(
        deleted=True,
        message="Credencial eliminada exitosamente",
    )


# =============================================================================
# Teacher Enrollment Permission Check
# =============================================================================


@router.get(
    "/teachers/{teacher_id}/can-enroll",
    summary="Verificar si profesor puede enrolar biometría",
)
# R10-A8 fix: Add rate limiting to prevent enumeration attacks
@limiter.limit("30/minute")
async def check_teacher_can_enroll(
    request,  # Required for rate limiter
    teacher_id: int = Path(..., ge=1),
    session: AsyncSession = Depends(deps.get_tenant_db),
    device_authenticated: bool = Depends(deps.verify_device_key),
):
    """
    Verifica si un profesor tiene permiso para enrolar estudiantes
    con biometría desde el kiosk.

    Usado por el kiosk para mostrar/ocultar la opción de registro.
    """
    if not device_authenticated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device key inválida"
        )

    teacher_repo = TeacherRepository(session)
    teacher = await teacher_repo.get(teacher_id)

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor no encontrado"
        )

    return {
        "teacher_id": teacher_id,
        "can_enroll_biometric": teacher.can_enroll_biometric,
    }


# =============================================================================
# User Passkey Endpoints (for web-app/teacher-pwa login)
# =============================================================================


@router.post(
    "/users/register/start",
    response_model=StartRegistrationResponse,
    summary="Iniciar registro de passkey para usuario",
)
async def start_user_passkey_registration(
    request: StartRegistrationRequest,
    current_user: AuthUser = Depends(deps.get_current_user),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Inicia el registro de un passkey para el usuario autenticado.

    Permite a usuarios del web-app y teacher-pwa registrar un passkey
    para futuras autenticaciones sin contraseña.
    """
    result = await webauthn_service.start_user_registration(
        user_id=current_user.id,
        device_name=request.device_name,
    )

    return StartRegistrationResponse(
        challenge_id=result["challenge_id"],
        options=result["options"],
    )


@router.post(
    "/users/register/complete",
    response_model=CredentialResponse,
    summary="Completar registro de passkey",
)
async def complete_user_passkey_registration(
    request: CompleteRegistrationRequest,
    current_user: AuthUser = Depends(deps.get_current_user),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Completa el registro de un passkey para el usuario autenticado.
    """
    credential = await webauthn_service.complete_user_registration(
        challenge_id=request.challenge_id,
        credential_response=request.credential,
    )

    return CredentialResponse(
        credential_id=credential.credential_id,
        device_name=credential.device_name,
        created_at=credential.created_at,
    )


@router.get(
    "/users/me/credentials",
    response_model=CredentialListResponse,
    summary="Listar mis passkeys",
)
async def list_my_passkeys(
    current_user: AuthUser = Depends(deps.get_current_user),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Lista todos los passkeys registrados para el usuario actual.
    """
    credentials = await webauthn_service.list_user_credentials(current_user.id)

    return CredentialListResponse(
        credentials=credentials,
        count=len(credentials),
    )


@router.delete(
    "/users/me/credentials/{credential_id}",
    response_model=DeleteCredentialResponse,
    summary="Eliminar mi passkey",
)
async def delete_my_passkey(
    credential_id: str,
    current_user: AuthUser = Depends(deps.get_current_user),
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Elimina uno de los passkeys del usuario actual.
    """
    deleted = await webauthn_service.delete_credential(
        credential_id=credential_id,
        user_id=current_user.id,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credencial no encontrada"
        )

    return DeleteCredentialResponse(
        deleted=True,
        message="Passkey eliminado exitosamente",
    )


# =============================================================================
# User Passkey Authentication (Password-less Login)
# =============================================================================


@router.post(
    "/users/authenticate/start",
    summary="Iniciar autenticación con passkey",
)
async def start_user_passkey_authentication(
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Inicia el flujo de autenticación sin contraseña con passkey.

    Retorna las opciones de autenticación WebAuthn para usar con
    navigator.credentials.get() en el navegador.
    """
    result = await webauthn_service.start_user_authentication()

    return {
        "challenge_id": result["challenge_id"],
        "options": result["options"],
    }


@router.post(
    "/users/authenticate/verify",
    summary="Verificar autenticación con passkey",
)
async def verify_user_passkey_authentication(
    request: VerifyAuthenticationRequest,
    webauthn_service: WebAuthnService = Depends(deps.get_webauthn_service),
):
    """
    Verifica la autenticación con passkey y retorna tokens JWT.

    Permite login sin contraseña usando huella digital, Face ID,
    o cualquier autenticador FIDO2 registrado.
    """
    from app.core.security import create_access_token, create_refresh_token

    # Verify the passkey authentication
    user = await webauthn_service.verify_user_authentication(
        challenge_id=request.challenge_id,
        credential_response=request.credential,
    )

    # Generate JWT tokens
    access_token = create_access_token(
        str(user.id),
        role=user.role,
        guardian_id=user.guardian_id,
    )
    refresh_token = create_refresh_token(str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }
