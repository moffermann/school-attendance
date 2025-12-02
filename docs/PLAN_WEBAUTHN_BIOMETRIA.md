# Plan de Implementación: Autenticación Biométrica (WebAuthn/Passkeys)

## Resumen Ejecutivo

Implementación de autenticación biométrica (huella digital, Face ID, Windows Hello) como método alternativo de identificación para estudiantes en el kiosk-app, utilizando el estándar WebAuthn/FIDO2 (Passkeys).

### Caso de Uso Principal
> Los estudiantes que olvidan su tarjeta de identificación (NFC/QR) podrán identificarse usando su huella digital u otro método biométrico registrado en el dispositivo del kiosko.

### Alcance
| Aplicación | Implementación | Prioridad |
|------------|----------------|-----------|
| **kiosk-app** | Botón "Usar Huella Digital" en home + flujo completo | **ALTA** |
| web-app | Login con passkey para admin/director/inspector | Media |
| teacher-pwa | Login con passkey para profesores | Media |

---

## Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────────────┐
│                        KIOSK APP                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HOME VIEW                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │   │
│  │  │ Escanear │  │  Entrada │  │ 🔐 Usar Huella      │   │   │
│  │  │ QR/NFC   │  │  Manual  │  │    Digital          │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  /api/v1/auth/passkey/*                  │   │
│  │  POST /register/start   → Iniciar registro credencial    │   │
│  │  POST /register/finish  → Verificar y guardar credencial │   │
│  │  POST /authenticate/start  → Obtener challenge           │   │
│  │  POST /authenticate/finish → Verificar y retornar user   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WebAuthnCredential (Model)                  │   │
│  │  - credential_id (PK)                                    │   │
│  │  - student_id (FK → students)                            │   │
│  │  - user_id (FK → users) [opcional]                       │   │
│  │  - public_key, sign_count, transports                    │   │
│  │  - device_name, created_at                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         REDIS                                   │
│  regflow:{flow_id} → {challenge, student_id, user_handle}       │
│  authflow:{flow_id} → {challenge}                               │
│  TTL: 5 minutos                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujos de Enrolamiento (Registro de Huellas)

El sistema soporta 3 vías para registrar las huellas digitales de los estudiantes:

### Opción A: Desde Kiosk (Profesor Autorizado)
```
1. Profesor se identifica en kiosk (QR/NFC/huella)
2. Si tiene permiso "can_enroll_biometric" → ve botón "Registrar Huellas"
3. Busca estudiante por nombre
4. Estudiante coloca dedo en el lector
5. Sistema guarda credencial → Estudiante puede usar huella
```
**Requisito:** Campo `can_enroll_biometric` en modelo Teacher

### Opción B: Desde Web-App (Director/Inspector)
```
1. Director/Inspector accede a web-app
2. Va a perfil del estudiante → "Registrar Huella Digital"
3. Sistema genera código temporal de enrolamiento (válido 5 min)
4. Estudiante va al kiosk → Ingresa código o escanea QR
5. Coloca dedo → Sistema asocia credencial al estudiante
```

### Opción C: Auto-registro Supervisado en Kiosk
```
1. Estudiante en kiosk selecciona "Registrar mi huella"
2. Sistema pide código PIN de autorización
3. Profesor/Admin presente ingresa su PIN
4. Estudiante coloca dedo → Registrado
```

---

## Fases de Implementación

### Fase 1: Backend - Modelo y Configuración
**Archivos a crear/modificar:**

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `app/db/models/webauthn_credential.py` | Crear | Modelo SQLAlchemy para credenciales |
| `app/db/models/__init__.py` | Modificar | Exportar nuevo modelo |
| `app/db/models/teacher.py` | Modificar | Agregar campo `can_enroll_biometric` |
| `app/db/models/student.py` | Modificar | Agregar relationship a credenciales |
| `app/db/models/user.py` | Modificar | Agregar relationship a credenciales |
| `app/core/config.py` | Modificar | Agregar variables RP_ID, RP_NAME, RP_ORIGIN |
| `pyproject.toml` | Modificar | Agregar dependencia `webauthn>=2.0.0` |

#### 1.1 Modelo WebAuthnCredential

```python
# app/db/models/webauthn_credential.py
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    # Identificador de la credencial (base64url del ID generado por el autenticador)
    credential_id = Column(String(512), primary_key=True)

    # Relaciones - Una credencial puede pertenecer a:
    # - Un estudiante (para kiosk)
    # - Un usuario del sistema (para web-app/teacher-pwa)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # User handle aleatorio (32 bytes) - Identificador WebAuthn
    user_handle = Column(LargeBinary(64), nullable=False, unique=True)

    # Clave pública en formato COSE (bytes)
    public_key = Column(LargeBinary, nullable=False)

    # Contador de uso (previene replay attacks)
    sign_count = Column(Integer, nullable=False, default=0)

    # Transportes soportados (USB, NFC, BLE, internal)
    transports = Column(String(100), nullable=True)

    # Metadata
    device_name = Column(String(100), nullable=True)  # Ej: "Kiosk Entrada Principal"
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)

    # Relationships
    student = relationship("Student", back_populates="webauthn_credentials")
    user = relationship("User", back_populates="webauthn_credentials")
```

#### 1.2 Actualizar Student y User models

```python
# app/db/models/student.py - Agregar relationship
webauthn_credentials = relationship("WebAuthnCredential", back_populates="student")

# app/db/models/user.py - Agregar relationship
webauthn_credentials = relationship("WebAuthnCredential", back_populates="user")
```

#### 1.3 Variables de Configuración

```python
# app/core/config.py - Agregar a Settings
class Settings(BaseSettings):
    # ... existentes ...

    # WebAuthn / Passkeys
    webauthn_rp_id: str = "localhost"  # Dominio (ej: "escuela.cl")
    webauthn_rp_name: str = "Sistema de Asistencia Escolar"
    webauthn_rp_origin: str = "http://localhost:8000"  # URL completa
    webauthn_timeout_ms: int = 60000  # 60 segundos
```

```bash
# .env.example - Agregar
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Sistema de Asistencia Escolar
WEBAUTHN_RP_ORIGIN=http://localhost:8000
WEBAUTHN_TIMEOUT_MS=60000
```

---

### Fase 2: Backend - Servicio WebAuthn

**Archivos a crear:**

| Archivo | Descripción |
|---------|-------------|
| `app/services/webauthn_service.py` | Lógica de negocio WebAuthn |
| `app/db/repositories/webauthn.py` | Acceso a datos de credenciales |
| `app/schemas/webauthn.py` | Schemas Pydantic para request/response |

#### 2.1 WebAuthn Service

```python
# app/services/webauthn_service.py
import os
import uuid
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelection,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
)

class WebAuthnService:
    def __init__(self, settings, redis_client, credential_repo, student_repo, user_repo):
        self.settings = settings
        self.redis = redis_client
        self.credential_repo = credential_repo
        self.student_repo = student_repo
        self.user_repo = user_repo

    # ==================== REGISTRO ====================

    async def start_registration_for_student(self, student_id: int) -> dict:
        """Inicia registro de passkey para un estudiante (desde kiosk admin)"""
        student = await self.student_repo.get_by_id(student_id)
        if not student:
            raise ValueError("Estudiante no encontrado")

        # Generar user_handle único
        user_handle = os.urandom(32)

        # Obtener credenciales existentes para excluirlas
        existing_creds = await self.credential_repo.get_by_student_id(student_id)
        exclude_credentials = [
            PublicKeyCredentialDescriptor(id=bytes.fromhex(c.credential_id))
            for c in existing_creds
        ]

        options = generate_registration_options(
            rp_id=self.settings.webauthn_rp_id,
            rp_name=self.settings.webauthn_rp_name,
            user_id=user_handle,
            user_name=f"student_{student_id}",
            user_display_name=student.full_name,
            attestation="none",
            authenticator_selection=AuthenticatorSelection(
                resident_key=ResidentKeyRequirement.REQUIRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            exclude_credentials=exclude_credentials,
            timeout=self.settings.webauthn_timeout_ms,
        )

        # Guardar en Redis
        flow_id = str(uuid.uuid4())
        reg_data = {
            "challenge": options.challenge,
            "user_handle": user_handle,
            "student_id": student_id,
            "user_id": None,
        }
        await self.redis.setex(
            f"regflow:{flow_id}",
            300,  # 5 minutos
            pickle.dumps(reg_data)
        )

        # Convertir a JSON y agregar flow_id
        opts_json = options_to_json(options)
        opts_json["flowId"] = flow_id

        return opts_json

    async def finish_registration(self, response: dict) -> dict:
        """Verifica y guarda la credencial registrada"""
        flow_id = response.get("flowId")
        if not flow_id:
            raise ValueError("Falta flowId")

        # Recuperar datos de Redis
        data_raw = await self.redis.get(f"regflow:{flow_id}")
        if not data_raw:
            raise ValueError("Registro expirado o inválido")

        reg_data = pickle.loads(data_raw)

        # Verificar respuesta
        verification = verify_registration_response(
            credential=response,
            expected_challenge=reg_data["challenge"],
            expected_rp_id=self.settings.webauthn_rp_id,
            expected_origin=self.settings.webauthn_rp_origin,
            require_user_verification=True,
        )

        if not verification.verified:
            raise ValueError("Verificación de registro fallida")

        # Guardar credencial
        credential = WebAuthnCredential(
            credential_id=response["id"],
            student_id=reg_data["student_id"],
            user_id=reg_data["user_id"],
            user_handle=reg_data["user_handle"],
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count or 0,
            transports=",".join(response.get("transports", [])),
        )

        await self.credential_repo.create(credential)

        # Limpiar Redis
        await self.redis.delete(f"regflow:{flow_id}")

        return {"message": "Credencial registrada exitosamente"}

    # ==================== AUTENTICACIÓN ====================

    async def start_authentication(self) -> dict:
        """Inicia autenticación sin usuario (usernameless)"""
        options = generate_authentication_options(
            rp_id=self.settings.webauthn_rp_id,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=self.settings.webauthn_timeout_ms,
            # allowCredentials vacío = discoverable credentials
        )

        flow_id = str(uuid.uuid4())
        auth_data = {"challenge": options.challenge}
        await self.redis.setex(
            f"authflow:{flow_id}",
            300,
            pickle.dumps(auth_data)
        )

        opts_json = options_to_json(options)
        opts_json["flowId"] = flow_id

        return opts_json

    async def finish_authentication(self, response: dict) -> dict:
        """Verifica la autenticación y retorna el estudiante/usuario"""
        flow_id = response.get("flowId")
        if not flow_id:
            raise ValueError("Falta flowId")

        # Recuperar challenge
        data_raw = await self.redis.get(f"authflow:{flow_id}")
        if not data_raw:
            raise ValueError("Autenticación expirada")

        auth_data = pickle.loads(data_raw)

        # Buscar credencial por ID
        cred_id = response.get("id")
        credential = await self.credential_repo.get_by_id(cred_id)
        if not credential:
            raise ValueError("Credencial no reconocida")

        # Verificar
        verification = verify_authentication_response(
            credential=response,
            expected_challenge=auth_data["challenge"],
            expected_rp_id=self.settings.webauthn_rp_id,
            expected_origin=self.settings.webauthn_rp_origin,
            credential_public_key=credential.public_key,
            credential_current_sign_count=credential.sign_count,
            require_user_verification=True,
        )

        if not verification.verified:
            raise ValueError("Autenticación fallida")

        # Actualizar sign_count y last_used
        await self.credential_repo.update_sign_count(
            cred_id,
            verification.new_sign_count
        )

        # Limpiar Redis
        await self.redis.delete(f"authflow:{flow_id}")

        # Retornar información del estudiante o usuario
        result = {"authenticated": True}

        if credential.student_id:
            student = await self.student_repo.get_by_id(credential.student_id)
            result["student"] = {
                "id": student.id,
                "full_name": student.full_name,
                "course_id": student.course_id,
            }
        elif credential.user_id:
            user = await self.user_repo.get_by_id(credential.user_id)
            result["user"] = {
                "id": user.id,
                "email": user.email,
                "role": user.role,
            }

        return result
```

#### 2.2 Schemas Pydantic

```python
# app/schemas/webauthn.py
from pydantic import BaseModel
from typing import Optional, Dict, Any

class RegistrationStartRequest(BaseModel):
    student_id: Optional[int] = None
    user_id: Optional[int] = None

class RegistrationStartResponse(BaseModel):
    challenge: str
    rp: Dict[str, str]
    user: Dict[str, str]
    pubKeyCredParams: list
    authenticatorSelection: Dict[str, str]
    timeout: int
    attestation: str
    flowId: str

class RegistrationFinishRequest(BaseModel):
    id: str
    rawId: str
    type: str
    response: Dict[str, str]
    clientExtensionResults: Optional[Dict[str, Any]] = {}
    flowId: str

class AuthenticationStartResponse(BaseModel):
    challenge: str
    rpId: str
    timeout: int
    userVerification: str
    allowCredentials: list
    flowId: str

class AuthenticationFinishRequest(BaseModel):
    id: str
    rawId: str
    type: str
    response: Dict[str, str]
    clientExtensionResults: Optional[Dict[str, Any]] = {}
    flowId: str

class AuthenticationResult(BaseModel):
    authenticated: bool
    student: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None
```

---

### Fase 3: Backend - Endpoints API

**Archivo a crear:** `app/api/v1/webauthn.py`

```python
# app/api/v1/webauthn.py
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_webauthn_service, verify_device_key, get_current_user_optional
from app.schemas.webauthn import *

router = APIRouter(prefix="/auth/passkey", tags=["WebAuthn"])

# ==================== REGISTRO ====================

@router.post("/register/start", response_model=dict)
async def start_registration(
    request: RegistrationStartRequest,
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),  # Requiere X-Device-Key
):
    """
    Inicia el registro de una passkey para un estudiante.
    Solo accesible desde dispositivos kiosk autorizados.
    """
    try:
        if request.student_id:
            options = await webauthn_service.start_registration_for_student(
                request.student_id
            )
        elif request.user_id:
            options = await webauthn_service.start_registration_for_user(
                request.user_id
            )
        else:
            raise HTTPException(400, "Debe especificar student_id o user_id")

        return options
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error interno: {e}")

@router.post("/register/finish")
async def finish_registration(
    request: RegistrationFinishRequest,
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),
):
    """Completa el registro de una passkey"""
    try:
        result = await webauthn_service.finish_registration(request.dict())
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error interno: {e}")

# ==================== AUTENTICACIÓN (KIOSK) ====================

@router.post("/authenticate/start", response_model=dict)
async def start_authentication(
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),
):
    """
    Inicia autenticación sin usuario (usernameless).
    El autenticador del dispositivo mostrará las credenciales disponibles.
    """
    try:
        options = await webauthn_service.start_authentication()
        return options
    except Exception as e:
        raise HTTPException(500, f"Error interno: {e}")

@router.post("/authenticate/finish")
async def finish_authentication(
    request: AuthenticationFinishRequest,
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),
):
    """
    Completa la autenticación y retorna información del estudiante/usuario.
    """
    try:
        result = await webauthn_service.finish_authentication(request.dict())
        return result
    except ValueError as e:
        raise HTTPException(401, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error interno: {e}")

# ==================== GESTIÓN DE CREDENCIALES ====================

@router.get("/credentials/student/{student_id}")
async def list_student_credentials(
    student_id: int,
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),
):
    """Lista las passkeys registradas de un estudiante"""
    credentials = await webauthn_service.get_student_credentials(student_id)
    return [
        {
            "credential_id": c.credential_id[:16] + "...",  # Truncado
            "device_name": c.device_name,
            "created_at": c.created_at.isoformat(),
            "last_used_at": c.last_used_at.isoformat() if c.last_used_at else None,
        }
        for c in credentials
    ]

@router.delete("/credentials/{credential_id}")
async def delete_credential(
    credential_id: str,
    webauthn_service = Depends(get_webauthn_service),
    _device_auth: bool = Depends(verify_device_key),
):
    """Elimina una passkey registrada"""
    try:
        await webauthn_service.delete_credential(credential_id)
        return {"message": "Credencial eliminada"}
    except ValueError as e:
        raise HTTPException(404, str(e))
```

---

### Fase 4: Frontend Kiosk - Módulo WebAuthn

**Archivos a crear:**

| Archivo | Descripción |
|---------|-------------|
| `src/kiosk-app/js/webauthn.js` | Módulo de WebAuthn (base64, API calls) |
| `src/kiosk-app/js/views/biometric_auth.js` | Vista de autenticación biométrica |
| `src/kiosk-app/js/views/biometric_register.js` | Vista de registro (admin) |

#### 4.1 Módulo WebAuthn

```javascript
// src/kiosk-app/js/webauthn.js
const WebAuthn = {
    // ==================== UTILIDADES ====================

    base64urlToArrayBuffer(base64url) {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) base64 += '='.repeat(4 - pad);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    arrayBufferToBase64url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        let base64 = btoa(binary);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    // ==================== DETECCIÓN ====================

    isSupported() {
        return !!window.PublicKeyCredential;
    },

    async isPlatformAuthenticatorAvailable() {
        if (!this.isSupported()) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
            return false;
        }
    },

    // ==================== REGISTRO ====================

    async startRegistration(studentId) {
        // 1. Obtener opciones del servidor
        const response = await fetch(`${State.config.apiBaseUrl}/auth/passkey/register/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Key': State.config.deviceApiKey,
            },
            body: JSON.stringify({ student_id: studentId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error iniciando registro');
        }

        const options = await response.json();

        // 2. Convertir base64url a ArrayBuffer
        options.challenge = this.base64urlToArrayBuffer(options.challenge);
        options.user.id = this.base64urlToArrayBuffer(options.user.id);

        if (options.excludeCredentials) {
            options.excludeCredentials = options.excludeCredentials.map(cred => ({
                ...cred,
                id: this.base64urlToArrayBuffer(cred.id),
            }));
        }

        // 3. Llamar a WebAuthn API
        const credential = await navigator.credentials.create({ publicKey: options });

        if (!credential) {
            throw new Error('No se pudo crear la credencial');
        }

        // 4. Preparar respuesta para el servidor
        const regPayload = {
            id: credential.id,
            rawId: this.arrayBufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                attestationObject: this.arrayBufferToBase64url(
                    credential.response.attestationObject
                ),
                clientDataJSON: this.arrayBufferToBase64url(
                    credential.response.clientDataJSON
                ),
            },
            clientExtensionResults: credential.getClientExtensionResults(),
            flowId: options.flowId,
        };

        // 5. Enviar al servidor
        const verifyResponse = await fetch(
            `${State.config.apiBaseUrl}/auth/passkey/register/finish`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Key': State.config.deviceApiKey,
                },
                body: JSON.stringify(regPayload),
            }
        );

        if (!verifyResponse.ok) {
            const error = await verifyResponse.json();
            throw new Error(error.detail || 'Error completando registro');
        }

        return await verifyResponse.json();
    },

    // ==================== AUTENTICACIÓN ====================

    async authenticate() {
        // 1. Obtener opciones del servidor
        const response = await fetch(
            `${State.config.apiBaseUrl}/auth/passkey/authenticate/start`,
            {
                method: 'POST',
                headers: {
                    'X-Device-Key': State.config.deviceApiKey,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error iniciando autenticación');
        }

        const options = await response.json();

        // 2. Convertir challenge
        options.challenge = this.base64urlToArrayBuffer(options.challenge);

        // allowCredentials vacío = usernameless (discoverable credentials)
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(cred => ({
                ...cred,
                id: this.base64urlToArrayBuffer(cred.id),
            }));
        }

        // 3. Llamar a WebAuthn API
        const credential = await navigator.credentials.get({ publicKey: options });

        if (!credential) {
            throw new Error('No se pudo obtener la credencial');
        }

        // 4. Preparar respuesta
        const authPayload = {
            id: credential.id,
            rawId: this.arrayBufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                authenticatorData: this.arrayBufferToBase64url(
                    credential.response.authenticatorData
                ),
                clientDataJSON: this.arrayBufferToBase64url(
                    credential.response.clientDataJSON
                ),
                signature: this.arrayBufferToBase64url(
                    credential.response.signature
                ),
                userHandle: credential.response.userHandle
                    ? this.arrayBufferToBase64url(credential.response.userHandle)
                    : null,
            },
            clientExtensionResults: credential.getClientExtensionResults(),
            flowId: options.flowId,
        };

        // 5. Enviar al servidor
        const verifyResponse = await fetch(
            `${State.config.apiBaseUrl}/auth/passkey/authenticate/finish`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Key': State.config.deviceApiKey,
                },
                body: JSON.stringify(authPayload),
            }
        );

        if (!verifyResponse.ok) {
            const error = await verifyResponse.json();
            throw new Error(error.detail || 'Autenticación fallida');
        }

        return await verifyResponse.json();
    },
};
```

#### 4.2 Vista de Autenticación Biométrica

```javascript
// src/kiosk-app/js/views/biometric_auth.js
const BiometricAuthView = {
    template: `
        <div class="biometric-auth-view">
            <div class="biometric-header">
                <h1>🔐 Identificación por Huella Digital</h1>
                <p>Coloca tu dedo en el lector de huellas</p>
            </div>

            <div class="biometric-status" id="biometricStatus">
                <div class="fingerprint-icon">
                    <svg viewBox="0 0 100 100" class="fingerprint-svg">
                        <!-- Ícono de huella animado -->
                        <path class="fingerprint-path" d="M50 10 C20 10 10 30 10 50 C10 80 30 90 50 90 C70 90 90 80 90 50 C90 30 80 10 50 10"/>
                    </svg>
                </div>
                <p class="status-text" id="statusText">Esperando autenticación...</p>
            </div>

            <div class="biometric-actions">
                <button class="btn-secondary" id="btnCancel">Cancelar</button>
            </div>
        </div>
    `,

    async render(container) {
        container.innerHTML = this.template;

        // Verificar soporte
        if (!WebAuthn.isSupported()) {
            this.showError('Este dispositivo no soporta autenticación biométrica');
            return;
        }

        // Event listeners
        document.getElementById('btnCancel').addEventListener('click', () => {
            Router.navigate('/');
        });

        // Iniciar autenticación automáticamente
        await this.startAuth();
    },

    async startAuth() {
        const statusText = document.getElementById('statusText');
        const statusContainer = document.getElementById('biometricStatus');

        try {
            statusText.textContent = 'Coloca tu dedo en el sensor...';
            statusContainer.classList.add('waiting');

            // Llamar a WebAuthn
            const result = await WebAuthn.authenticate();

            if (result.authenticated && result.student) {
                // Éxito - procesar como un escaneo normal
                statusContainer.classList.remove('waiting');
                statusContainer.classList.add('success');
                statusText.textContent = `¡Hola, ${result.student.full_name}!`;

                // Navegar a resultado del escaneo
                setTimeout(() => {
                    Router.navigate('/scan-result', {
                        student: result.student,
                        method: 'biometric',
                    });
                }, 1000);
            }
        } catch (error) {
            statusContainer.classList.remove('waiting');
            statusContainer.classList.add('error');

            if (error.name === 'NotAllowedError') {
                statusText.textContent = 'Autenticación cancelada';
            } else if (error.message.includes('no reconocida')) {
                statusText.textContent = 'Huella no registrada en el sistema';
            } else {
                statusText.textContent = `Error: ${error.message}`;
            }

            // Volver a intentar o cancelar
            setTimeout(() => {
                this.showRetryOption();
            }, 2000);
        }
    },

    showRetryOption() {
        const actionsDiv = document.querySelector('.biometric-actions');
        actionsDiv.innerHTML = `
            <button class="btn-primary" id="btnRetry">Intentar de nuevo</button>
            <button class="btn-secondary" id="btnCancel2">Volver al inicio</button>
        `;

        document.getElementById('btnRetry').addEventListener('click', () => {
            document.getElementById('biometricStatus').className = 'biometric-status';
            this.startAuth();
        });

        document.getElementById('btnCancel2').addEventListener('click', () => {
            Router.navigate('/');
        });
    },

    showError(message) {
        document.getElementById('statusText').textContent = message;
        document.getElementById('biometricStatus').classList.add('error');
    },
};
```

#### 4.3 Modificar Vista Home

```javascript
// src/kiosk-app/js/views/home.js - Agregar botón de huella digital
// Agregar al template HTML existente:

const biometricButton = `
    <button class="home-action-btn biometric-btn" id="btnBiometric">
        <span class="icon">🔐</span>
        <span class="label">Usar Huella Digital</span>
    </button>
`;

// En el método render(), agregar:
async function initBiometricButton() {
    const btn = document.getElementById('btnBiometric');

    // Verificar si WebAuthn está soportado
    if (!WebAuthn.isSupported()) {
        btn.style.display = 'none';
        return;
    }

    // Verificar si hay autenticador de plataforma disponible
    const hasAuthenticator = await WebAuthn.isPlatformAuthenticatorAvailable();
    if (!hasAuthenticator) {
        btn.disabled = true;
        btn.title = 'No hay lector de huellas disponible';
    }

    btn.addEventListener('click', () => {
        Router.navigate('/biometric-auth');
    });
}
```

---

### Fase 5: Integración con Flujo de Asistencia

Una vez que la autenticación biométrica identifica al estudiante, se debe registrar el evento de asistencia igual que con QR/NFC.

#### 5.1 Modificar scan_result.js

```javascript
// src/kiosk-app/js/views/scan_result.js
// El flujo existente ya maneja estudiantes, solo necesitamos pasar el origen

async function processStudent(student, method = 'qr') {
    const eventType = State.nextEventTypeFor(student.id);

    const event = {
        student_id: student.id,
        type: eventType,  // 'IN' o 'OUT'
        device_id: State.device.id,
        gate_id: State.device.gate_id,
        method: method,  // 'qr', 'nfc', 'biometric', 'manual'
        occurred_at: new Date().toISOString(),
    };

    // El resto del flujo es igual
    State.enqueueEvent(event);

    // Si tiene consentimiento de foto y method != biometric
    if (State.hasPhotoConsent(student.id) && method !== 'biometric') {
        // Activar cámara para foto
        await capturePhoto(event);
    }

    await Sync.processQueue();
}
```

---

### Fase 6: Panel de Administración (Registro de Huellas)

El registro de passkeys para estudiantes debe hacerse desde el panel de administración del kiosk o desde la web-app.

#### 6.1 Vista de Registro en Kiosk Admin

```javascript
// src/kiosk-app/js/views/admin_biometric.js
const AdminBiometricView = {
    template: `
        <div class="admin-biometric-view">
            <h2>Registro de Huella Digital</h2>

            <div class="search-section">
                <input type="text" id="searchStudent" placeholder="Buscar estudiante...">
                <div id="searchResults"></div>
            </div>

            <div class="selected-student" id="selectedStudent" style="display:none">
                <h3>Estudiante seleccionado:</h3>
                <p id="studentName"></p>
                <p id="studentCourse"></p>

                <div class="credentials-list" id="credentialsList">
                    <h4>Huellas registradas:</h4>
                    <ul id="credentialsUl"></ul>
                </div>

                <button class="btn-primary" id="btnRegister">
                    Registrar Nueva Huella
                </button>
            </div>

            <button class="btn-secondary" id="btnBack">Volver</button>
        </div>
    `,

    selectedStudentId: null,

    async render(container) {
        container.innerHTML = this.template;
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Búsqueda de estudiantes
        document.getElementById('searchStudent').addEventListener('input', (e) => {
            this.searchStudents(e.target.value);
        });

        // Registrar huella
        document.getElementById('btnRegister').addEventListener('click', () => {
            this.registerFingerprint();
        });

        // Volver
        document.getElementById('btnBack').addEventListener('click', () => {
            Router.navigate('/admin');
        });
    },

    searchStudents(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        const results = State.students.filter(s =>
            s.full_name.toLowerCase().includes(query.toLowerCase())
        );

        const html = results.slice(0, 10).map(s => `
            <div class="search-result" data-id="${s.id}">
                ${s.full_name}
            </div>
        `).join('');

        document.getElementById('searchResults').innerHTML = html;

        // Event listeners para resultados
        document.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                this.selectStudent(parseInt(el.dataset.id));
            });
        });
    },

    async selectStudent(studentId) {
        this.selectedStudentId = studentId;
        const student = State.students.find(s => s.id === studentId);

        document.getElementById('selectedStudent').style.display = 'block';
        document.getElementById('studentName').textContent = student.full_name;
        document.getElementById('searchResults').innerHTML = '';

        // Cargar credenciales existentes
        await this.loadCredentials(studentId);
    },

    async loadCredentials(studentId) {
        try {
            const response = await fetch(
                `${State.config.apiBaseUrl}/auth/passkey/credentials/student/${studentId}`,
                {
                    headers: { 'X-Device-Key': State.config.deviceApiKey },
                }
            );

            const credentials = await response.json();

            const html = credentials.length > 0
                ? credentials.map(c => `
                    <li>
                        ${c.device_name || 'Dispositivo'}
                        - Registrado: ${new Date(c.created_at).toLocaleDateString()}
                        <button class="btn-small btn-danger" data-id="${c.credential_id}">
                            Eliminar
                        </button>
                    </li>
                `).join('')
                : '<li>No hay huellas registradas</li>';

            document.getElementById('credentialsUl').innerHTML = html;
        } catch (error) {
            console.error('Error cargando credenciales:', error);
        }
    },

    async registerFingerprint() {
        if (!this.selectedStudentId) return;

        try {
            UI.showLoading('Coloca el dedo en el lector...');

            const result = await WebAuthn.startRegistration(this.selectedStudentId);

            UI.hideLoading();
            UI.showSuccess('¡Huella registrada exitosamente!');

            // Recargar lista
            await this.loadCredentials(this.selectedStudentId);
        } catch (error) {
            UI.hideLoading();

            if (error.name === 'NotAllowedError') {
                UI.showError('Registro cancelado por el usuario');
            } else {
                UI.showError(`Error: ${error.message}`);
            }
        }
    },
};
```

---

### Fase 7: Testing

#### 7.1 Tests Unitarios Backend

```python
# tests/test_webauthn.py
import pytest
from unittest.mock import Mock, patch
from app.services.webauthn_service import WebAuthnService

@pytest.fixture
def mock_webauthn_service():
    settings = Mock()
    settings.webauthn_rp_id = "localhost"
    settings.webauthn_rp_name = "Test App"
    settings.webauthn_rp_origin = "http://localhost:8000"
    settings.webauthn_timeout_ms = 60000

    redis = Mock()
    cred_repo = Mock()
    student_repo = Mock()
    user_repo = Mock()

    return WebAuthnService(settings, redis, cred_repo, student_repo, user_repo)

class TestWebAuthnService:

    async def test_start_registration_for_student(self, mock_webauthn_service):
        """Debe generar opciones de registro válidas"""
        mock_webauthn_service.student_repo.get_by_id.return_value = Mock(
            id=1, full_name="Juan Pérez"
        )
        mock_webauthn_service.credential_repo.get_by_student_id.return_value = []
        mock_webauthn_service.redis.setex = Mock()

        with patch('app.services.webauthn_service.generate_registration_options') as mock_gen:
            mock_gen.return_value = Mock(
                challenge=b'test_challenge',
                # ... otros campos
            )

            result = await mock_webauthn_service.start_registration_for_student(1)

            assert 'flowId' in result
            assert mock_webauthn_service.redis.setex.called

    async def test_start_registration_student_not_found(self, mock_webauthn_service):
        """Debe lanzar error si el estudiante no existe"""
        mock_webauthn_service.student_repo.get_by_id.return_value = None

        with pytest.raises(ValueError, match="Estudiante no encontrado"):
            await mock_webauthn_service.start_registration_for_student(999)

    async def test_finish_registration_expired(self, mock_webauthn_service):
        """Debe lanzar error si el registro expiró"""
        mock_webauthn_service.redis.get.return_value = None

        with pytest.raises(ValueError, match="expirado"):
            await mock_webauthn_service.finish_registration({"flowId": "expired"})

    async def test_start_authentication(self, mock_webauthn_service):
        """Debe generar opciones de autenticación sin allowCredentials"""
        mock_webauthn_service.redis.setex = Mock()

        with patch('app.services.webauthn_service.generate_authentication_options') as mock_gen:
            mock_gen.return_value = Mock(challenge=b'auth_challenge')

            result = await mock_webauthn_service.start_authentication()

            assert 'flowId' in result
            # allowCredentials debe estar vacío (usernameless)

    async def test_finish_authentication_credential_not_found(self, mock_webauthn_service):
        """Debe retornar 401 si la credencial no existe"""
        mock_webauthn_service.redis.get.return_value = b'pickled_data'
        mock_webauthn_service.credential_repo.get_by_id.return_value = None

        with pytest.raises(ValueError, match="no reconocida"):
            await mock_webauthn_service.finish_authentication({
                "flowId": "test",
                "id": "unknown_cred"
            })
```

#### 7.2 Tests de Integración

```python
# tests/test_webauthn_integration.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
class TestWebAuthnEndpoints:

    async def test_register_start_requires_device_key(self):
        """Debe requerir X-Device-Key header"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/auth/passkey/register/start", json={
                "student_id": 1
            })
            assert response.status_code == 403

    async def test_register_start_with_device_key(self):
        """Debe aceptar request con X-Device-Key válido"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/passkey/register/start",
                json={"student_id": 1},
                headers={"X-Device-Key": "test-device-key"}
            )
            # Puede ser 400 si estudiante no existe, pero no 403
            assert response.status_code != 403

    async def test_authenticate_flow(self):
        """Test del flujo completo de autenticación (mockeado)"""
        # Este test requiere mockear la verificación WebAuthn
        pass
```

#### 7.3 Tests E2E con Playwright

```javascript
// tests/e2e/webauthn.spec.js
const { test, expect } = require('@playwright/test');

test.describe('WebAuthn Biometric Authentication', () => {

    test.beforeEach(async ({ page, context }) => {
        // Configurar autenticador virtual
        const cdp = await context.newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: true,
            }
        });
    });

    test('should show biometric button on home page', async ({ page }) => {
        await page.goto('/kiosk');
        await expect(page.locator('#btnBiometric')).toBeVisible();
    });

    test('should navigate to biometric auth view', async ({ page }) => {
        await page.goto('/kiosk');
        await page.click('#btnBiometric');
        await expect(page.locator('.biometric-auth-view')).toBeVisible();
    });

    test('should show error for unregistered fingerprint', async ({ page }) => {
        await page.goto('/kiosk');
        await page.click('#btnBiometric');

        // Esperar mensaje de error (no hay credenciales registradas)
        await expect(page.locator('.status-text')).toContainText('no registrada');
    });
});
```

---

### Fase 8: Documentación

#### 8.1 Actualizar CLAUDE.md

```markdown
## WebAuthn / Passkeys (Autenticación Biométrica)

### Descripción
Sistema de autenticación biométrica (huella digital, Face ID, Windows Hello)
para estudiantes en el kiosk como alternativa a QR/NFC.

### Archivos Clave
| Archivo | Propósito |
|---------|-----------|
| `app/db/models/webauthn_credential.py` | Modelo de credenciales WebAuthn |
| `app/services/webauthn_service.py` | Lógica de negocio |
| `app/api/v1/webauthn.py` | Endpoints de la API |
| `src/kiosk-app/js/webauthn.js` | Cliente JavaScript WebAuthn |
| `src/kiosk-app/js/views/biometric_auth.js` | Vista de autenticación |

### Endpoints
- `POST /api/v1/auth/passkey/register/start` - Iniciar registro
- `POST /api/v1/auth/passkey/register/finish` - Completar registro
- `POST /api/v1/auth/passkey/authenticate/start` - Iniciar autenticación
- `POST /api/v1/auth/passkey/authenticate/finish` - Completar autenticación

### Variables de Entorno
```bash
WEBAUTHN_RP_ID=escuela.cl
WEBAUTHN_RP_NAME=Sistema de Asistencia
WEBAUTHN_RP_ORIGIN=https://escuela.cl
```
```

#### 8.2 Manual de Usuario

Crear `docs/manual_biometria.md` con:
- Guía de registro de huellas para administradores
- Guía de uso para estudiantes
- Solución de problemas comunes
- Capturas de pantalla

---

## Cronograma de Implementación

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| **1** | Modelo y Configuración | Ninguna |
| **2** | Servicio WebAuthn | Fase 1 |
| **3** | Endpoints API | Fase 2 |
| **4** | Frontend Kiosk - Módulo WebAuthn | Fase 3 |
| **5** | Integración con Flujo de Asistencia | Fase 4 |
| **6** | Panel de Administración | Fase 4 |
| **7** | Testing | Fases 1-6 |
| **8** | Documentación | Fases 1-7 |

---

## Consideraciones de Seguridad

1. **HTTPS obligatorio** en producción (WebAuthn lo requiere)
2. **Credenciales residentes** (discoverable) para login sin usuario
3. **User verification required** - siempre pedir biometría/PIN
4. **Challenges de un solo uso** con expiración en Redis (5 min)
5. **Sign count validation** para detectar clonación de credenciales
6. **User handle aleatorio** (no usar datos personales como ID)

---

## Compatibilidad

| Dispositivo/Navegador | Soporte |
|----------------------|---------|
| Chrome (Windows/Mac/Linux) | ✅ Windows Hello, Touch ID |
| Safari (macOS/iOS) | ✅ Touch ID, Face ID |
| Edge (Windows) | ✅ Windows Hello |
| Firefox | ✅ (limitado) |
| Android Chrome | ✅ Huella, Face Unlock |

---

## Recursos de Referencia

- [WebAuthn Guide (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [py_webauthn Documentation](https://duo-labs.github.io/py_webauthn/)
- [Yubico WebAuthn Developer Guide](https://developers.yubico.com/WebAuthn/)
- [Passkeys.dev](https://passkeys.dev/)
