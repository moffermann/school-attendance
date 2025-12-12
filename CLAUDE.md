# School Attendance System - Claude Context

## Project Overview

Sistema de control de asistencia escolar con notificaciones automáticas a apoderados por WhatsApp.

### Tech Stack
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (async), PostgreSQL
- **Queue:** Redis + RQ (workers)
- **Frontend:** Vanilla JavaScript (no framework)
- **Storage:** AWS S3 (fotos)
- **Notifications:** WhatsApp Cloud API, AWS SES (email)

### Project Structure
```
school-attendance/
├── app/                      # Backend FastAPI
│   ├── api/v1/              # API endpoints
│   ├── core/                # Config, auth, deps
│   ├── db/                  # Models, repositories
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   └── workers/jobs/        # RQ background jobs
├── src/
│   ├── kiosk-app/           # Kiosk frontend (vanilla JS)
│   ├── web-app/             # Admin/Parent web app
│   └── teacher-pwa/         # Teacher PWA
├── tests/                   # Pytest tests
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

---

## Key Implementation: WhatsApp Notifications System

### Architecture Flow
```
KIOSK (QR/NFC) → POST /attendance/events → AttendanceService
                                                  ↓
                                    AttendanceNotificationService
                                                  ↓
                                            Redis Queue
                                                  ↓
                                    Worker: send_whatsapp.py
                                                  ↓
                                        WhatsApp Cloud API
```

### Key Files

#### Backend Notifications
| File | Purpose |
|------|---------|
| `app/services/attendance_notification_service.py` | Dispatches notifications to guardians |
| `app/services/attendance_service.py` | Triggers notifications in `register_event()` |
| `app/services/notifications/whatsapp.py` | WhatsApp Cloud API client |
| `app/services/notifications/dispatcher.py` | Manual notification dispatch |
| `app/workers/jobs/send_whatsapp.py` | Async worker for sending messages |

#### Photo Consent
| File | Purpose |
|------|---------|
| `app/db/models/student.py` | `photo_pref_opt_in` field |
| `app/services/consent_service.py` | Manages guardian preferences |
| `app/api/v1/parents.py` | Guardian preference endpoints |

#### Kiosk Photo Handling
| File | Purpose |
|------|---------|
| `src/kiosk-app/js/sync.js` | `syncStudents()`, `syncBootstrap()` |
| `src/kiosk-app/js/state.js` | `hasPhotoConsent(studentId)` |
| `src/kiosk-app/js/views/scan_result.js` | Camera activation based on consent |

#### Parent Preferences UI
| File | Purpose |
|------|---------|
| `src/web-app/js/views/parent_prefs.js` | Notification preferences UI |
| `src/web-app/js/api.js` | `getGuardianPreferences()`, `updateGuardianPreferences()` |

---

## API Endpoints

### Attendance
- `POST /api/v1/attendance/events` - Register IN/OUT event (triggers notifications)
- `POST /api/v1/attendance/events/{id}/photo` - Upload photo for event
- `GET /api/v1/attendance/students/{id}` - List student events

### Parent Preferences
- `GET /api/v1/parents/{guardian_id}/preferences` - Get preferences
- `PUT /api/v1/parents/{guardian_id}/preferences` - Update preferences

### Kiosk Sync
- `GET /api/v1/kiosk/bootstrap` - Full data sync (students, tags, teachers)
- `GET /api/v1/kiosk/students` - Students with `photo_pref_opt_in`

---

## Data Models

### Guardian Preferences Format
```json
{
  "preferences": {
    "INGRESO_OK": {"whatsapp": true, "email": false},
    "SALIDA_OK": {"whatsapp": true, "email": false},
    "NO_INGRESO_UMBRAL": {"whatsapp": true, "email": true},
    "CAMBIO_HORARIO": {"whatsapp": true, "email": true}
  },
  "photo_consents": {
    "1": true,
    "2": false
  }
}
```

### Notification Payload
```json
{
  "student_name": "María González",
  "student_id": 1,
  "event_type": "IN",
  "event_id": 123,
  "occurred_at": "2024-03-15T08:30:00",
  "date": "15/03/2024",
  "time": "08:30",
  "gate_id": "GATE-A",
  "photo_url": "https://s3.../photo.jpg",
  "has_photo": true
}
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/school

# Redis
REDIS_URL=redis://localhost:6379/0

# WhatsApp
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
ENABLE_REAL_NOTIFICATIONS=false  # true for production

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=school-photos

# Security
DEVICE_API_KEY=kiosk_secret_key
SECRET_KEY=jwt_secret
```

---

## WhatsApp Templates Required

Templates must be created in Meta Business Suite:

1. **ingreso_ok** - "Ingreso registrado: {{1}} ingresó al colegio el {{2}} a las {{3}}."
2. **salida_ok** - "Salida registrada: {{1}} salió del colegio el {{2}} a las {{3}}."
3. **no_ingreso_umbral** - "Alerta: {{1}} no ha registrado ingreso al colegio hoy {{2}}."
4. **cambio_horario** - "Aviso: Se ha modificado el horario de {{1}} para el {{2}}."

See `docs/whatsapp-templates.md` for full setup guide.

---

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_attendance_notifications.py -v

# Run with coverage
pytest --cov=app tests/
```

### WhatsApp Setup Validation
```bash
python scripts/whatsapp_setup.py --validate
python scripts/whatsapp_setup.py --test-message +56912345678
python scripts/whatsapp_setup.py --templates
```

---

## Recent Changes (Session 2024-11-27)

### Implemented Features

1. **Fase 1: Automatic WhatsApp Notifications**
   - Created `AttendanceNotificationService`
   - Integrated notification trigger into `register_event()`
   - Extended WhatsApp client with `send_image_message()`
   - Updated worker to handle photos with captions

2. **Fase 2: Kiosk Photo Consent Respect**
   - Kiosk syncs student preferences from backend
   - Camera only activates if `photo_opt_in=true`
   - Auto-sync preferences every 5 minutes

3. **Fase 3: Parent Preferences UI**
   - Full preferences UI in web-app
   - Integration with backend API
   - Real-time visual feedback
   - Fallback to localStorage if API fails

4. **Fase 4: WhatsApp Documentation**
   - Template documentation in `docs/whatsapp-templates.md`
   - Setup/validation script `scripts/whatsapp_setup.py`

### Commits
```
da3c4eb Merge 'feature/parent-preferences-ui'
a898f98 docs: WhatsApp templates and setup script
652633f feat(web-app): Parent preferences with API
41e0309 Merge 'feature/kiosk-photo-preferences'
e0835c7 feat(kiosk): Respect photo consent
6ed76a3 Merge 'feature/attendance-notifications'
69915e2 feat: Automatic WhatsApp notifications
```

---

## Pending / Future Work

### Not Yet Implemented
- [x] Email notifications (COMPLETE: HTML templates, tenant support, integrated in attendance flow)
- [ ] Template approval in Meta Business Suite (manual step)
- [ ] End-to-end testing with real WhatsApp/Email

### Optional Enhancements
- [x] NFC tag support (COMPLETE: backend API, Tag model, Web NFC in kiosk/admin)
- [ ] Granular photo privacy settings (who can view, custom retention)
- [ ] Notification delivery status tracking webhook
- [ ] Parent mobile app

---

## Commands Reference

```bash
# Development
make dev-up              # Start with Docker
make test                # Run tests
make lint                # Run linters

# Database
make migrate             # Run migrations
make seed                # Seed development data

# Manual testing
python scripts/whatsapp_setup.py --validate
```

---

## Troubleshooting

### Notifications Not Sending
1. Check `ENABLE_REAL_NOTIFICATIONS=true`
2. Verify Redis is running and worker is active
3. Check worker logs: `rq worker notifications`
4. Validate WhatsApp config: `python scripts/whatsapp_setup.py --validate`

### Kiosk Not Showing Camera
1. Check `State.config.photoEnabled` is true
2. Verify student has `photo_opt_in: true` in data
3. Check browser camera permissions
4. Inspect `State.hasPhotoConsent(studentId)` return value

### Preferences Not Saving
1. Check API authentication (Bearer token)
2. Verify guardian_id matches logged-in user
3. Check network tab for API errors
4. Falls back to localStorage if API fails

---

## WebAuthn/Biometric Authentication (Session 2024-12-02)

### Overview
Students can use fingerprint/biometric authentication as an alternative to NFC/QR cards at kiosk devices.

### Key Files

#### Backend WebAuthn
| File | Purpose |
|------|---------|
| `app/services/webauthn_service.py` | WebAuthn registration/authentication logic |
| `app/db/repositories/webauthn.py` | Credential CRUD operations |
| `app/api/v1/webauthn.py` | REST API endpoints |
| `app/db/models/webauthn_credential.py` | Credential database model |
| `app/schemas/webauthn.py` | Pydantic request/response schemas |

#### Kiosk Biometric
| File | Purpose |
|------|---------|
| `src/kiosk-app/js/webauthn.js` | WebAuthn client module |
| `src/kiosk-app/js/views/biometric_auth.js` | Fingerprint authentication UI |
| `src/kiosk-app/js/views/biometric_enroll.js` | Student enrollment UI for teachers |

#### Web Admin
| File | Purpose |
|------|---------|
| `src/web-app/js/views/director_biometric.js` | Admin panel for credential management |

### API Endpoints

#### Kiosk (Device-Authenticated)
- `POST /api/v1/webauthn/kiosk/students/{id}/register/start` - Start enrollment
- `POST /api/v1/webauthn/kiosk/students/register/complete` - Complete enrollment
- `POST /api/v1/webauthn/kiosk/authenticate/start` - Start auth
- `POST /api/v1/webauthn/kiosk/authenticate/verify` - Verify auth

#### Admin (JWT-Authenticated)
- `POST /api/v1/webauthn/admin/students/{id}/register/start` - Admin enrollment
- `GET /api/v1/webauthn/admin/students/{id}/credentials` - List credentials
- `DELETE /api/v1/webauthn/admin/students/{id}/credentials/{cred_id}` - Remove credential

### Configuration

```bash
# WebAuthn Settings
WEBAUTHN_RP_ID=localhost                    # Domain for credentials
WEBAUTHN_RP_NAME=Sistema Asistencia Escolar
WEBAUTHN_RP_ORIGIN=http://localhost:8000
WEBAUTHN_TIMEOUT_MS=60000
```

### Database Migration

```bash
alembic upgrade head  # Creates webauthn_credentials table
```

Migration: `app/db/migrations/versions/0006_webauthn_credentials.py`

### Usage Flow

1. **Enrollment**: Teacher/Admin registers student's fingerprint
2. **Authentication**: Student taps "Usa tu huella" at kiosk
3. **Attendance**: System identifies student and records event

### Troubleshooting

#### "Tu dispositivo no soporta autenticación biométrica"
- Browser doesn't support WebAuthn or no fingerprint sensor
- Solution: Use NFC/QR card instead

#### "Challenge inválido o expirado"
- Registration/auth took too long (default 60s)
- Solution: Start the process again

#### "Credencial no reconocida"
- Student's biometric not registered on this device
- Solution: Re-register or use alternative method

See `docs/webauthn-biometric.md` for complete documentation.
