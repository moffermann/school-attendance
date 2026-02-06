# 2026-01-12: Mejoras de Fotos, Source de Asistencia e Internacionalización

## Resumen

Sesión enfocada en múltiples mejoras:
- **Migraciones DB**: Nuevos campos `national_id`, `photo_url` en estudiantes y `source` en eventos
- **Internacionalización**: Renombrado `rut` → `national_id` para soporte multi-país
- **Fotos autenticadas**: Blob URL pattern para cargar fotos a través del túnel Cloudflare
- **Source de asistencia**: Tracking del método usado (BIOMETRIC, QR, NFC, MANUAL)
- **Kiosk sync**: Restauración de estado IN/OUT después de limpiar caché
- **Biometría/WebAuthn**: Fixes en options JSON, debug logging, source uppercase

---

## 1. Migraciones de Base de Datos

### Migration 0013: Student National ID y Photo URL

```python
# Nuevo campo para identificación nacional (RUT Chile, DNI Argentina, etc.)
op.add_column("students", sa.Column("national_id", sa.String(20), nullable=True))
op.create_index("ix_students_national_id", "students", ["national_id"])

# URL de foto del estudiante
op.add_column("students", sa.Column("photo_url", sa.String(512), nullable=True))
```

### Migration 0014: Attendance Source

```python
# Enum para método de registro de asistencia
attendance_source = sa.Enum("BIOMETRIC", "QR", "NFC", "MANUAL", name="attendance_source")

op.add_column("attendance_events", sa.Column("source", attendance_source, nullable=True))
op.create_index("ix_attendance_events_source", "attendance_events", ["source"])
```

---

## 2. Internacionalización: `rut` → `national_id`

### Problema
El campo `rut` era específico de Chile. Para soportar otros países (Argentina con DNI, Perú con DNI, etc.) se necesitaba un nombre genérico.

### Cambios Realizados

| Archivo | Cambio |
|---------|--------|
| `app/db/models/student.py` | Nuevo campo `national_id` |
| `app/schemas/webauthn.py` | `rut` → `national_id` en KioskAuthenticationResult |
| `app/api/v1/webauthn.py` | Response usa `national_id` |
| `src/web-app/js/nfc-enrollment.js` | vCard y UI usan `national_id` |
| `src/web-app/js/qr-enrollment.js` | PDF y UI usan `national_id` |
| `src/kiosk-app/js/state.js` | `rut` → `national_id` en updateStudent |

---

## 3. Source de Asistencia (BIOMETRIC, QR, NFC, MANUAL)

### Modelo y Schema

```python
# app/db/models/attendance_event.py
class AttendanceSourceEnum(str, Enum):
    BIOMETRIC = "BIOMETRIC"  # WebAuthn/Passkey fingerprint
    QR = "QR"                # QR code scan
    NFC = "NFC"              # NFC card/tag
    MANUAL = "MANUAL"        # Manual entry by staff

class AttendanceEvent(Base):
    source: Mapped[str | None] = mapped_column(
        SAEnum(AttendanceSourceEnum, name="attendance_source"),
        nullable=True,  # Backward compatible
        index=True
    )
```

### Uso
El kiosk ahora envía el source en cada evento:
```javascript
const event = {
  student_id: student.id,
  type: eventType,  // 'IN' o 'OUT'
  source: source    // 'BIOMETRIC', 'QR', 'NFC'
};
```

---

## 4. Blob URL para Fotos Autenticadas

### Problema
- Las fotos se almacenan en MinIO y requieren autenticación (JWT o Device Key)
- Los tags `<img src="...">` no pueden enviar headers de autenticación
- Resultado: Error 403 Forbidden al cargar fotos a través del túnel

### Solución: Patrón Blob URL

```javascript
// 1. Fetch con headers de autenticación
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 2. Convertir a blob
const blob = await response.blob();

// 3. Crear Object URL
const blobUrl = URL.createObjectURL(blob);

// 4. Usar en <img src={blobUrl}>
```

### Implementación

#### Web-App (`src/web-app/js/api.js`)
```javascript
imageCache: new Map(),
MAX_CACHE_SIZE: 50,

async loadAuthenticatedImage(url) {
  // Caché LRU, timeout 10s, cleanup automático
}

clearImageCache() {
  this.imageCache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
  this.imageCache.clear();
}

logout() {
  this.accessToken = null;
  this.refreshToken = null;
  this.clearImageCache(); // Limpiar blobs al cerrar sesión
}
```

#### Kiosk (`src/kiosk-app/js/sync.js`)
```javascript
imageCache: new Map(),
MAX_CACHE_SIZE: 30, // Menos memoria en kiosk

async loadImageWithDeviceKey(url) {
  const headers = this.getHeaders();  // X-Device-Key
  delete headers['Content-Type'];
  // Mismo patrón: fetch → blob → createObjectURL
}
```

#### Director Students View
```javascript
let photoLoadCounter = 0;  // Race condition protection

// En showEditForm() y viewProfile():
const currentPhotoLoadId = ++photoLoadCounter;

API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
  if (photoLoadCounter !== currentPhotoLoadId) return; // Stale update
  img.src = blobUrl;
});
```

---

## 5. Kiosk: Sincronización de Estado IN/OUT

### Problema
Después de limpiar la caché del kiosk, se perdía el estado de qué estudiantes ya habían entrado (IN), causando que el próximo registro fuera IN en lugar de OUT.

### Solución

#### Nuevo Endpoint `/api/v1/kiosk/today-events`
```python
@router.get("/today-events")
async def get_kiosk_today_events(...):
    today = date.today()
    events = await attendance_repo.list_by_date(today)
    return [KioskTodayEventRead(...) for e in events]
```

#### Bootstrap incluye eventos del día
```python
class KioskBootstrapResponse(BaseModel):
    students: list[KioskStudentRead]
    tags: list[KioskTagRead]
    teachers: list[KioskTeacherRead]
    today_events: list[KioskTodayEventRead] = []  # NUEVO
```

#### State.importTodayEvents()
```javascript
importTodayEvents(serverEvents) {
  for (const event of serverEvents) {
    // Agregar como 'synced' para que cuente en nextEventTypeFor()
    this.queue.push({
      id: `server_${event.id}`,
      server_id: event.id,
      student_id: event.student_id,
      type: event.type,
      ts: event.ts,
      status: 'synced',
      from_server: true
    });
  }
}
```

#### Fix Bug parseInt en nextEventTypeFor()
```javascript
nextEventTypeFor(studentId) {
  // BUG-FIX: Ensure numeric comparison
  const numStudentId = parseInt(studentId, 10);
  const todayEvents = this.queue.filter(e => {
    const eventStudentId = parseInt(e.student_id, 10);
    return eventStudentId === numStudentId && e.ts.startsWith(today);
  });
  // ...
}
```

---

## 6. Kiosk: Config siempre de JSON

### Problema
La configuración del kiosk (apiBaseUrl, deviceApiKey) se guardaba en localStorage y podía quedar desactualizada.

### Solución
```javascript
// State.init() ahora separa:
// 1. Datos dinámicos (queue, students) → localStorage
// 2. Config y device → siempre de data/*.json

async init() {
  // Solo restaurar datos de usuario
  const stored = localStorage.getItem('kioskData');
  if (stored) {
    this.students = data.students || [];
    this.queue = data.queue || [];
    // NO restaurar config ni device
  }

  // Siempre cargar config fresca
  await this.loadConfigFromJSON();
}

persist() {
  // Solo persistir datos dinámicos
  localStorage.setItem('kioskData', JSON.stringify({
    students, teachers, tags, queue, localSeq
    // config y device NO se persisten
  }));
}
```

---

## 7. WebAuthn/Biometría Fixes

### Backend: options_to_json() retorna objeto
```python
# Antes (causaba doble stringify en frontend):
return {"options": options_to_json(options)}  # String

# Después:
return {"options": json.loads(options_to_json(options))}  # Object
```

### Backend: get_with_course() para evitar lazy loading
```python
# En verify_student_authentication():
student = await self.student_repo.get_with_course(credential.student_id)
# Evita error de lazy loading fuera de sesión
```

### Kiosk: biometric_auth.js - Source uppercase
```javascript
// Antes:
Router.navigate(`/scan-result?student_id=${result.student.student_id}&source=Biometric`);

// Después (coincide con enum AttendanceSourceEnum):
Router.navigate(`/scan-result?student_id=${result.student.student_id}&source=BIOMETRIC`);
```

### Kiosk: biometric_enroll.js - national_id y photo_url
```javascript
// Búsqueda ahora usa national_id
const matches = State.students.filter(s =>
  s.full_name.toLowerCase().includes(lowerQuery) ||
  (s.national_id && s.national_id.includes(query))  // antes: s.rut
);

// UI muestra national_id
<div class="student-list-info">${student.national_id || 'Sin ID'}</div>  // antes: student.rut

// Avatar usa photo_url con fallback
${selectedStudent.photo_url
  ? `<img src="${selectedStudent.photo_url}" onerror="this.parentElement.innerHTML='<span>👤</span>'">`
  : '<span class="avatar-placeholder">👤</span>'
}
```

### Kiosk: webauthn.js - Debug logging
Agregados console.log detallados para troubleshooting del flujo WebAuthn:
```javascript
console.log('[WebAuthn] Starting authentication, config:', config);
console.log('[WebAuthn] Step 1: Requesting auth options from server...');
console.log('[WebAuthn] Step 1 response status:', startResponse.status);
console.log('[WebAuthn] Step 2: Requesting credential from browser...');
console.log('[WebAuthn] Step 3: Verifying with server...');
// etc.
```

Esto facilita debuggear problemas de autenticación biométrica en producción.

---

## 8. Photo Service Enhancements

### Nuevo método get_photo()
```python
async def get_photo(self, key: str) -> tuple[bytes, str] | None:
    """Download a photo from S3/MinIO."""
    response = self._client.get_object(Bucket=self._bucket, Key=key)
    content_type = response.get("ContentType", "image/jpeg")
    data = response["Body"].read()
    return data, content_type
```

### Presigned URL con public endpoint
```python
async def generate_presigned_url(self, key: str, expires: int = 3600) -> str | None:
    url = await asyncio.to_thread(_generate)

    # Replace internal endpoint with public URL if configured
    if settings.s3_public_url and url:
        url = url.replace(settings.s3_endpoint, settings.s3_public_url.rstrip('/'))

    return url
```

---

## 9. Nuevo Endpoint: Photo Proxy

### `GET /api/v1/photos/{key:path}`
```python
@router.get("/{key:path}")
async def get_photo(key: str, ...):
    """Proxy endpoint for accessing photos stored in S3/MinIO."""
    photo_service = PhotoService()
    result = await photo_service.get_photo(key)

    return Response(
        content=result[0],
        media_type=result[1],
        headers={"Cache-Control": "private, max-age=3600"}
    )
```

Acepta autenticación por:
- JWT: `Authorization: Bearer {token}`
- Device Key: `X-Device-Key: {key}`

---

## Archivos Modificados

```
40 files changed, +1672, -136

Backend:
- app/api/v1/kiosk.py (+109)
- app/api/v1/photos.py (nuevo, +69)
- app/api/v1/router.py (+4)
- app/api/v1/students.py (nuevo, +248)
- app/api/v1/webauthn.py (+4)
- app/core/config.py (+5)
- app/db/models/attendance_event.py (+14)
- app/db/models/student.py (+4)
- app/db/repositories/attendance.py (+15)
- app/db/repositories/students.py (+30)
- app/schemas/attendance.py (+10)
- app/schemas/webauthn.py (+4)
- app/services/photo_service.py (+37)
- app/services/webauthn_service.py (+13)
- app/db/migrations/versions/0013_student_natid_photo.py (nuevo)
- app/db/migrations/versions/0014_attendance_source.py (nuevo)

Kiosk-App:
- src/kiosk-app/js/state.js (+116)
- src/kiosk-app/js/sync.js (+114)
- src/kiosk-app/js/views/home.js (+91)
- src/kiosk-app/js/views/biometric_auth.js (+2) - source BIOMETRIC uppercase
- src/kiosk-app/js/views/biometric_enroll.js (+8) - national_id, photo_url
- src/kiosk-app/js/webauthn.js (+22) - debug logging
- src/kiosk-app/css/styles.css (+75)
- src/kiosk-app/index.html (+103)

Web-App:
- src/web-app/js/api.js (+177)
- src/web-app/js/views/director_students.js (+189)
- src/web-app/js/nfc-enrollment.js (+6)
- src/web-app/js/qr-enrollment.js (+6)
```

---

## Testing Realizado

### Fotos Autenticadas
- ✅ Fotos se cargan en modal de edición (director)
- ✅ Fotos se cargan en modal de perfil (director)
- ✅ Fotos se cargan en kiosk después de scan
- ✅ Sin errores 403 Forbidden
- ✅ Caché funciona (segunda carga instantánea)

### IN/OUT State
- ✅ Bootstrap trae eventos del día
- ✅ nextEventTypeFor() funciona después de cache clear
- ✅ parseInt fix evita bugs de comparación

### Internacionalización
- ✅ QR PDF muestra "ID" en lugar de "RUT"
- ✅ NFC vCard usa national_id
- ✅ WebAuthn response usa national_id

### Biometría/WebAuthn
- ✅ Autenticación biométrica funciona en kiosk
- ✅ Enrollment de huella muestra national_id
- ✅ Avatar en enrollment usa photo_url con fallback
- ✅ Source se guarda como BIOMETRIC (uppercase)
- ✅ Debug logs facilitan troubleshooting

---

## Próximos Pasos

1. Monitorear uso de memoria del image cache en producción
2. Considerar pre-carga de fotos frecuentes en kiosk
3. Agregar validación de national_id por país (regex)
4. Dashboard de reportes por source de asistencia
