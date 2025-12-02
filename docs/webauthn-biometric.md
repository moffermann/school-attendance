# WebAuthn/Biometric Authentication System

## Overview

This document describes the WebAuthn (FIDO2/Passkey) implementation for biometric authentication in the school attendance system. The system allows students to use fingerprint or other biometric methods as an alternative to NFC/QR cards at kiosk devices.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Kiosk App     │    │   Web App       │    │   Backend API   │
│  (Fingerprint)  │───▶│  (Admin Panel)  │───▶│   (FastAPI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  PostgreSQL DB  │
                                              │  (Credentials)  │
                                              └─────────────────┘
```

### Components

1. **Backend (FastAPI)**
   - WebAuthn Service (`app/services/webauthn_service.py`)
   - WebAuthn Repository (`app/db/repositories/webauthn.py`)
   - API Endpoints (`app/api/v1/webauthn.py`)
   - Credential Model (`app/db/models/webauthn_credential.py`)

2. **Kiosk Frontend**
   - WebAuthn Module (`src/kiosk-app/js/webauthn.js`)
   - Authentication View (`src/kiosk-app/js/views/biometric_auth.js`)
   - Enrollment View (`src/kiosk-app/js/views/biometric_enroll.js`)

3. **Web Admin Panel**
   - Biometric Management (`src/web-app/js/views/director_biometric.js`)

## WebAuthn Credential Types

### Student Credentials (Kiosk)
- Used for attendance check-in/check-out at kiosk devices
- Platform authenticator only (built-in fingerprint/Face ID)
- Discoverable credentials for usernameless authentication
- Registered by teachers (with `can_enroll_biometric` permission) or admins

### User Credentials (Passkeys)
- Used for web-app and teacher-pwa login
- Cross-platform authenticators supported (phones, security keys)
- Alternative to password-based authentication

## API Endpoints

### Kiosk Endpoints (Device-Authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/webauthn/kiosk/students/{id}/register/start` | POST | Start student enrollment |
| `/api/v1/webauthn/kiosk/students/register/complete` | POST | Complete enrollment |
| `/api/v1/webauthn/kiosk/authenticate/start` | POST | Start authentication |
| `/api/v1/webauthn/kiosk/authenticate/verify` | POST | Verify authentication |

### Admin Endpoints (JWT-Authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/webauthn/admin/students/{id}/register/start` | POST | Admin-initiated enrollment |
| `/api/v1/webauthn/admin/students/{id}/credentials` | GET | List student credentials |
| `/api/v1/webauthn/admin/students/{id}/credentials/{cred_id}` | DELETE | Remove credential |

### User Endpoints (JWT-Authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/webauthn/users/register/start` | POST | Start passkey registration |
| `/api/v1/webauthn/users/register/complete` | POST | Complete registration |
| `/api/v1/webauthn/users/me/credentials` | GET | List own credentials |
| `/api/v1/webauthn/users/me/credentials/{id}` | DELETE | Remove own credential |

## Enrollment Flows

### Flow A: Teacher Enrollment at Kiosk

1. Teacher logs into admin panel at kiosk
2. Navigates to "Registro Biometrico"
3. Searches and selects student
4. Clicks "Registrar Huella"
5. Student places finger on sensor
6. Credential is stored

```javascript
// Kiosk-side
const result = await WebAuthn.registerStudent(studentId, 'Kiosk Principal');
```

### Flow B: Admin Enrollment from Web App

1. Director/Inspector logs into web-app
2. Navigates to "Biometria" section
3. Searches and selects student
4. Clicks "Registrar Credencial"
5. Uses browser's WebAuthn (for testing) or guides student at kiosk
6. Credential is stored

### Flow C: Self-Registration (Future)

Students could self-register with admin PIN verification at kiosk.

## Authentication Flow

1. Student taps "Usa tu huella" on kiosk home screen
2. Kiosk requests authentication options from backend
3. Student places finger on sensor
4. Browser/kiosk performs WebAuthn authentication
5. Backend verifies assertion and identifies student
6. Attendance event is registered

```javascript
// Client-side authentication
const result = await WebAuthn.authenticateStudent();
if (result.success) {
    Router.navigate(`/scan-result?student_id=${result.student.student_id}&source=Biometric`);
}
```

## Database Schema

### webauthn_credentials Table

| Column | Type | Description |
|--------|------|-------------|
| credential_id | VARCHAR(512) PK | Base64URL-encoded credential ID |
| student_id | INT FK | Reference to student (nullable) |
| user_id | INT FK | Reference to user (nullable) |
| user_handle | BYTEA | Random 32-byte identifier |
| public_key | BYTEA | COSE-encoded public key |
| sign_count | INT | Counter for replay protection |
| transports | VARCHAR(100) | Supported transports (internal,usb,nfc) |
| device_name | VARCHAR(100) | Human-readable device name |
| created_at | TIMESTAMP | Registration timestamp |
| last_used_at | TIMESTAMP | Last authentication timestamp |

### teachers.can_enroll_biometric

Added boolean column to teachers table to control who can register student biometrics at kiosk.

## Configuration

Environment variables in `.env`:

```bash
# WebAuthn Settings
WEBAUTHN_RP_ID=school.example.com           # Relying Party ID (domain)
WEBAUTHN_RP_NAME=Sistema Asistencia Escolar # Display name
WEBAUTHN_RP_ORIGIN=https://school.example.com # Origin for verification
WEBAUTHN_TIMEOUT_MS=60000                   # Timeout in milliseconds
```

For development (localhost):
```bash
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:8000
```

## Security Considerations

### Challenge Storage
Currently uses in-memory dictionary for development. For production:
- Use Redis with TTL for challenge storage
- Implement proper expiration cleanup
- Consider clustering/session affinity

### Credential Protection
- Credentials are tied to RP ID (domain)
- User verification required for all operations
- Sign count validation detects cloned authenticators
- Credentials auto-delete when student/user is deleted (CASCADE)

### Permission Model
- Only directors can access biometric admin panel
- Teachers need `can_enroll_biometric=true` for kiosk enrollment
- Users can only manage their own passkey credentials

## Browser Support

WebAuthn is supported in:
- Chrome 67+ (Windows, macOS, Android, Linux)
- Firefox 60+
- Safari 14+ (macOS, iOS)
- Edge 18+

Platform authenticators (fingerprint):
- Windows Hello (Windows 10+)
- Touch ID (macOS, iOS)
- Android fingerprint (Android 7+)

## Testing

Run WebAuthn tests:
```bash
pytest tests/test_webauthn.py -v
```

Test categories:
- Repository CRUD operations
- Service business logic
- Challenge management
- Error handling

## Troubleshooting

### "Tu dispositivo no soporta autenticacion biometrica"
- Browser doesn't support WebAuthn
- No platform authenticator available
- Solution: Use NFC/QR card instead

### "Challenge invalido o expirado"
- Registration/auth took too long (>60s default)
- Challenge was already used
- Solution: Start the process again

### "Credencial no reconocida"
- Student's biometric not registered
- Wrong device/fingerprint
- Solution: Re-register or use alternative method

### Sign Count Warning
If sign count goes backwards, authenticator may be cloned:
- Investigate immediately
- Delete suspect credential
- Re-register on trusted device

## Migration

Run migration to create WebAuthn tables:
```bash
alembic upgrade head
```

Migration file: `app/db/migrations/versions/0006_webauthn_credentials.py`

## Future Enhancements

- [ ] Redis-based challenge storage for production
- [ ] User passkey authentication flow
- [ ] Backup/recovery codes for students
- [ ] Audit logging for biometric events
- [ ] Multiple device support per student
- [ ] Admin dashboard for credential analytics
