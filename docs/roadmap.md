# School Attendance – Roadmap de Mejoras 2025

> **Última actualización:** 2025-12-01
> **Basado en:** Auditoría completa del codebase

---

## Resumen Ejecutivo

Auditoría completa del codebase realizada el 2025-12-01. Se identificaron **55+ issues** categorizados por severidad:

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| Crítico | 6 | Vulnerabilidades de seguridad que requieren atención inmediata |
| Alto | 14 | Bugs y problemas que afectan estabilidad/funcionalidad |
| Medio | 23 | Deuda técnica y mejoras de mantenibilidad |
| Bajo | 12 | Optimizaciones y mejoras menores |

**Áreas afectadas:** Seguridad, Estabilidad, Tests/CI, Infraestructura, Rendimiento, Accesibilidad

---

## Estado Actual del Proyecto

### Completado (Fases Anteriores)
- ✅ Backend FastAPI con autenticación JWT y sesión
- ✅ Kiosk App con QR, NFC, multi-idioma, panel admin
- ✅ Teacher PWA con sync offline, IndexedDB
- ✅ Web App con dashboard, reportes, alertas
- ✅ Rate limiting, CORS, refresh tokens
- ✅ CI con lint + tests backend
- ✅ Docker monolito con worker + scheduler
- ✅ 353 tests (281 backend + 72 E2E)
- ✅ ~81% coverage backend

---

## Fase 1: Seguridad (Crítico)

### 1.1 XSS - Escapar datos de usuario en HTML

**Archivos afectados:**
- `src/web-app/js/views/parent_prefs.js:116-132`
- `src/kiosk-app/js/views/scan_result.js:53-66`

**Problema:** Interpolación directa de `student.full_name`, `course.name`, `guardian_name` sin escape. Un nombre malicioso como `<img src=x onerror=alert(1)>` ejecutaría JavaScript.

**Código problemático:**
```javascript
<div style="font-weight: 600;">${student.full_name}</div>
<div>${course ? course.name : ''}</div>
<div class="welcome-guardian">Apoderado: ${student.guardian_name || 'No registrado'}</div>
```

**Solución:**
```javascript
<div style="font-weight: 600;">${Components.escapeHtml(student.full_name)}</div>
<div>${course ? Components.escapeHtml(course.name) : ''}</div>
<div class="welcome-guardian">Apoderado: ${Components.escapeHtml(student.guardian_name) || 'No registrado'}</div>
```

---

### 1.2 Redis sin fallback en servicios críticos

**Archivo:** `app/services/attendance_notification_service.py:31-32`

**Problema:** Si Redis no está disponible, `AttendanceNotificationService.__init__` falla completamente y afecta el registro de asistencia (operación crítica del sistema).

**Código problemático:**
```python
def __init__(self):
    self._redis = Redis.from_url(settings.redis_url)
    self._queue = Queue("notifications", connection=self._redis)
```

**Solución:** Implementar lazy loading con fallback graceful:
```python
def __init__(self):
    self._redis = None
    self._queue = None

@property
def queue(self):
    if self._queue is None:
        try:
            self._redis = Redis.from_url(settings.redis_url)
            self._queue = Queue("notifications", connection=self._redis)
        except Exception as e:
            logger.error(f"Redis unavailable, notifications disabled: {e}")
            return None
    return self._queue

async def dispatch(self, event, guardians):
    if self.queue is None:
        logger.warning(f"Skipping notification for event {event.id}: Redis unavailable")
        return
    # ... resto del código
```

---

### 1.3 Inyección de formato en mensajes WhatsApp

**Archivo:** `app/workers/jobs/send_whatsapp.py:20-33`

**Problema:** El método `_build_caption()` usa `template.format(**variables)` con datos de usuario sin sanitizar. Un estudiante con nombre como `María {__class__}` podría inyectar formato de strings.

**Código problemático:**
```python
def _build_caption(template: str, variables: dict) -> str:
    return template.format(**variables)
```

**Solución:** Usar escape explícito o Jinja2 con autoescape:
```python
def _build_caption(template: str, variables: dict) -> str:
    # Escapar llaves en variables para prevenir inyección
    safe_vars = {k: str(v).replace("{", "{{").replace("}", "}}")
                 for k, v in variables.items()}
    return template.format(**safe_vars)
```

---

### 1.4 Tokens JWT en localStorage (vulnerable a XSS)

**Archivo:** `src/web-app/js/api.js:13-23`

**Problema:** Los tokens JWT se almacenan en `localStorage`, que es accesible desde cualquier script JavaScript. Si hay una vulnerabilidad XSS (como las identificadas en 1.1), un atacante puede robar los tokens.

**Código problemático:**
```javascript
get accessToken() {
    return localStorage.getItem('accessToken');
}

set accessToken(token) {
    if (token) {
        localStorage.setItem('accessToken', token);
    }
}
```

**Solución:** Migrar a `sessionStorage` (expira al cerrar tab) y usar HttpOnly cookies para refresh token:
```javascript
get accessToken() {
    return sessionStorage.getItem('accessToken');
}

set accessToken(token) {
    if (token) {
        sessionStorage.setItem('accessToken', token);
    } else {
        sessionStorage.removeItem('accessToken');
    }
}
```

---

### 1.5 Photo consent default inseguro

**Archivo:** `src/kiosk-app/js/state.js:195-199`

**Problema:** La función `hasPhotoConsent()` retorna `true` por defecto si el estudiante no existe en el sistema. Esto viola el principio de privacidad por defecto.

**Código problemático:**
```javascript
hasPhotoConsent(studentId) {
    const student = this.students.find(s => s.id === studentId);
    return student ? (student.photo_opt_in !== false) : true;  // DEFAULT PELIGROSO
}
```

**Solución:**
```javascript
hasPhotoConsent(studentId) {
    const student = this.students.find(s => s.id === studentId);
    // Privacidad por defecto: si no existe o no tiene consentimiento explícito, no permitir
    return student ? (student.photo_opt_in === true) : false;
}
```

---

### 1.6 Validación de roles solo en cliente

**Archivo:** `src/web-app/js/state.js:44-67`

**Problema:** Los roles se almacenan en `localStorage` y se validan únicamente en el cliente. Un atacante puede cambiar `localStorage.currentRole` a 'director' y acceder a funcionalidades restringidas.

**Código problemático:**
```javascript
const role = localStorage.getItem('currentRole');
if (role && this.VALID_ROLES.includes(role)) {
    this.currentRole = role;
}
```

**Solución:**
1. El backend DEBE re-validar roles en cada request (verificar que esto ocurra)
2. Agregar validación de integridad del rol:
```javascript
// El rol debe venir del token JWT decodificado, no de localStorage
setCurrentRole(role) {
    if (this.user && this.user.roles.includes(role)) {
        this.currentRole = role;
        localStorage.setItem('currentRole', role);
    }
}
```

---

## Fase 2: Estabilidad (Bugs y Race Conditions)

### 2.1 Race condition en notificaciones de asistencia

**Archivo:** `app/services/attendance_service.py:50-56`

**Problema:** El commit de la transacción ocurre ANTES de enviar las notificaciones. Si hay un rollback posterior, la notificación ya fue disparada pero el evento no existe en la base de datos.

**Código problemático:**
```python
await self.session.commit()  # Línea 51 - commit primero
# ... código intermedio ...
await self._send_attendance_notifications(event)  # Línea 54 - notificación después
```

**Solución:** Mover el commit después de las notificaciones o usar transacción explícita con rollback compensatorio:
```python
try:
    await self._send_attendance_notifications(event)
    await self.session.commit()
except Exception as e:
    await self.session.rollback()
    logger.error(f"Failed to process event {event.id}: {e}")
    raise
```

---

### 2.2 Race condition en cámara del kiosk

**Archivo:** `src/kiosk-app/js/views/scan_result.js:127-154`

**Problema:** Si `startEvidenceCamera()` se llama múltiples veces rápidamente (ej: doble click), se crean múltiples streams de video sin liberar los anteriores, causando memory leaks y comportamiento errático.

**Código problemático:**
```javascript
async function startEvidenceCamera() {
    video = document.getElementById('evidence-video');
    // Sin verificar si ya existe stream activo
    const stream = await navigator.mediaDevices.getUserMedia({...});
    video.srcObject = stream;
}
```

**Solución:**
```javascript
async function startEvidenceCamera() {
    video = document.getElementById('evidence-video');

    // Prevenir múltiples inicializaciones
    if (video.srcObject) {
        console.log('Camera already active');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({...});
        video.srcObject = stream;
    } catch (e) {
        console.error('Camera initialization failed:', e);
    }
}
```

---

### 2.3 Fuga de memoria - intervals sin limpiar

**Archivo:** `src/kiosk-app/js/views/scan_result.js:115`

**Problema:** El `clockInterval` continúa ejecutándose si la vista cambia sin llamar explícitamente a `stopLiveClock()`.

**Código problemático:**
```javascript
clockInterval = setInterval(() => {
    timeElement.textContent = formatTime(new Date());
}, 1000);
```

**Solución:** Verificar que el elemento existe antes de actualizar y usar cleanup automático:
```javascript
clockInterval = setInterval(() => {
    const timeElement = document.getElementById('live-clock');
    if (!timeElement) {
        clearInterval(clockInterval);
        return;
    }
    timeElement.textContent = formatTime(new Date());
}, 1000);
```

---

### 2.4 Estado inconsistente en sync

**Archivo:** `src/kiosk-app/js/sync.js:43-109`

**Problema:** Si el evento se sincroniza exitosamente pero la foto falla, el evento queda marcado como synced pero sin foto. El sistema no reintenta subir la foto.

**Código problemático:**
```javascript
if (response.ok) {
    const result = await response.json();
    event.server_id = result.id;
    if (event.photo_data && result.id) {
        await this.uploadPhoto(result.id, event.photo_data);  // Si falla, evento ya está "synced"
    }
    State.markSynced(event.id);
}
```

**Solución:**
```javascript
if (response.ok) {
    const result = await response.json();
    event.server_id = result.id;

    let photoSuccess = true;
    if (event.photo_data && result.id) {
        try {
            await this.uploadPhoto(result.id, event.photo_data);
        } catch (e) {
            console.error('Photo upload failed:', e);
            photoSuccess = false;
        }
    }

    if (photoSuccess || !event.photo_data) {
        State.markSynced(event.id);
    } else {
        State.markPartialSync(event.id);  // Nuevo estado para reintentar foto
    }
}
```

---

### 2.5 PhotoService devuelve string vacío en error

**Archivo:** `app/services/photo_service.py:43-52`

**Problema:** `generate_presigned_url()` retorna string vacío `""` en lugar de lanzar excepción o retornar `None`, lo que causa errores silenciosos en notificaciones WhatsApp.

**Solución:** Retornar `None` explícito y manejar en el caller.

---

### 2.6 Sin manejo de transacción en detect_no_ingreso

**Archivo:** `app/workers/jobs/detect_no_ingreso.py:90`

**Problema:** El commit final ocurre aunque algunas notificaciones individuales fallen en el bucle.

**Solución:** Usar savepoints para rollback selectivo por notificación fallida.

---

### 2.7 Token blacklist memory leak

**Archivo:** `app/core/token_blacklist.py:93-98`

**Problema:** La limpieza de tokens expirados solo ocurre cuando se agrega un nuevo token.

**Solución:** Implementar limpieza periódica o usar `OrderedDict` con tamaño máximo.

---

## Fase 3: Calidad (Tests y CI/CD)

### 3.1 Agregar tests frontend a CI

**Archivo:** `.github/workflows/ci.yml`

**Problema:** Los tests de Playwright (E2E frontend) no se ejecutan en CI. Solo se ejecutan tests de Python.

**Solución:** Agregar job para tests frontend:
```yaml
frontend-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright browsers
      run: npx playwright install --with-deps
    - name: Run E2E tests
      run: npm run test:all
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

---

### 3.2 Teacher PWA sin tests

**Directorio:** `tests/e2e/teacher-pwa/`

**Problema:** Solo tiene 2 archivos básicos (auth.spec.js, navigation.spec.js). Falta cobertura de funcionalidades principales.

**Solución:** Crear tests para:
- Registro de asistencia manual
- Vista de lista de estudiantes
- Selección de curso
- Sincronización offline
- Manejo de errores de red

---

### 3.3 Web-app sin tests unitarios

**Directorio:** `tests/e2e/web-app/unit/`

**Problema:** Solo hay tests E2E, sin tests unitarios para JavaScript.

**Solución:** Agregar tests con Vitest para:
- State management (`state.js`)
- API client (`api.js`)
- Componentes y utilidades
- Validaciones de formularios

---

### 3.4 Migraciones con numeración duplicada

**Directorio:** `app/db/migrations/versions/`

**Problema:** Existen dos archivos con prefijo `0002_`:
- `0002_add_absence_comment.py`
- `0002_add_users.py`

**Solución:** Renumerar `0002_add_users.py` a `0006_add_users.py` y actualizar dependencias.

---

### 3.5 Coverage reports

**Problema:** No hay métricas de cobertura de código publicadas ni badge en el README.

**Solución:** Agregar a CI:
```yaml
- name: Run tests with coverage
  run: pytest --cov=app --cov-report=xml --cov-report=html
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
```

---

### 3.6 Docker build validation en CI

**Problema:** El CI no valida que la imagen Docker se construye correctamente.

**Solución:** Agregar step de `docker build` y health check en CI.

---

## Fase 4: Mantenibilidad

### 4.1 Rate limiting en endpoints críticos

**Archivo:** `app/api/v1/attendance.py:14-28`

**Problema:** El endpoint POST `/events` que registra asistencia no tiene rate limiting.

**Solución:** Agregar `@limiter.limit("60/minute")`.

---

### 4.2 Rate limiting en kiosk bootstrap

**Archivo:** `app/api/v1/kiosk.py:51-113`

**Problema:** Los endpoints de bootstrap retornan TODOS los datos sin rate limiting.

**Solución:** Rate limiting + logging de acceso.

---

### 4.3 Código duplicado en API clients

**Archivos:**
- `src/web-app/js/api.js`
- `src/teacher-pwa/js/api.js`

**Problema:** ~130 líneas de código idénticas entre ambos archivos.

**Solución:** Crear módulo compartido `src/lib/api-base.js`.

---

### 4.4 CSV export sin escape

**Archivos:**
- `app/api/v1/absences.py:53-57`
- `app/api/v1/alerts.py:79-82`

**Problema:** Los exports CSV usan f-strings sin escape.

**Solución:** Usar `csv.writer` en lugar de f-strings.

---

### 4.5 Validación de fecha en schemas

**Archivo:** `app/api/v1/teachers.py:148-151`

**Problema:** `datetime.fromisoformat()` puede lanzar `ValueError` en runtime.

**Solución:** Validar en Pydantic schema con validator personalizado.

---

### 4.6 Imports duplicados

**Archivo:** `app/db/repositories/notifications.py:4-5`

**Problema:** `datetime` está importado dos veces.

**Solución:** Remover la línea duplicada.

---

### 4.7 Docker compose duplication

**Archivos:**
- `docker-compose.yml` (producción)
- `infra/docker-compose.yml` (desarrollo)

**Problema:** Dos versiones del archivo a mantener sincronizadas.

**Solución:** Consolidar en un único `docker-compose.yml` con override files.

---

### 4.8 Documentación desactualizada

**Archivos:**
- `docs/local-dev.md` - menciona SQLite, está obsoleto
- `docs/roadmap.md` vs `docs/roadmap-2025-11.md` - duplicados

**Solución:** Actualizar y consolidar documentación.

---

## Fase 5: Mejoras de Rendimiento

### 5.1 Paginación en dashboard

**Archivo:** `src/web-app/js/views/director_dashboard.js:120-150`

**Problema:** Renderiza todos los eventos sin paginación ni virtualización.

**Solución:** Implementar paginación o virtual scrolling.

---

### 5.2 Attach photo lee archivo completo antes de validar

**Archivo:** `app/services/attendance_service.py:152-186`

**Problema:** El archivo se lee completamente en memoria antes de validar el tamaño.

**Solución:** Leer en chunks y validar tamaño durante la lectura.

---

### 5.3 Foto base64 sin compresión óptima

**Archivo:** `src/kiosk-app/js/views/scan_result.js:177`

**Problema:** Calidad de JPEG en 0.8 genera archivos grandes.

**Solución:** Reducir calidad a 0.5-0.6 o implementar envío fragmentado.

---

### 5.4 Service worker cache strategy

**Archivo:** `src/kiosk-app/service-worker.js:42-48`

**Problema:** Cache-first siempre, sin invalidación inteligente.

**Solución:** Usar stale-while-revalidate para datos dinámicos.

---

## Fase 6: Accesibilidad (WCAG)

### 6.1 ARIA labels faltantes

**Archivos:**
- `src/kiosk-app/js/views/scan_result.js:91,101`

**Problema:** Botones sin texto visible carecen de `aria-label`.

**Solución:** Agregar `aria-label` descriptivo a todos los botones icónicos.

---

### 6.2 Contraste de colores

**Archivo:** `src/web-app/js/views/director_dashboard.js:45`

**Problema:** `--color-gray-500` sobre fondo blanco no cumple ratio 4.5:1 de WCAG AA.

**Solución:** Usar `--color-gray-600` o más oscuro para texto secundario.

---

### 6.3 Skip links

**Problema:** Ningún frontend tiene enlaces "Skip to content" para navegación asistida.

**Solución:** Agregar en todas las apps.

---

## Fase 7: Seguridad Adicional

### 7.1 Dependabot

**Problema:** No hay scanning automático de vulnerabilidades en dependencias.

**Solución:** Crear `.github/dependabot.yml`.

---

### 7.2 Bandit para Python

**Problema:** No hay análisis de seguridad estático del código Python.

**Solución:** Agregar bandit a pre-commit y CI.

---

### 7.3 Logging de datos sensibles

**Archivo:** `app/workers/jobs/send_whatsapp.py:79-84`

**Problema:** Números de teléfono completos aparecen en logs.

**Solución:** Mascarear: `+569123*****78`.

---

## Fase 8: Features Futuros (Ideas)

| # | Feature | Estado | Descripción |
|---|---------|--------|-------------|
| 8.1 | **Notificaciones Email** | SES client existe, no integrado | Integrar AWS SES en flujo de asistencia |
| 8.2 | **NFC backend completo** | Frontend OK, backend parcial | Endpoints y modelos para tags NFC |
| 8.3 | **App móvil apoderados** | Solo web responsiva | PWA dedicada o React Native |
| 8.4 | **Webhook WhatsApp** | Sin tracking de entrega | Webhook Meta para status |
| 8.5 | **Dashboard analytics** | Solo datos operacionales | Métricas históricas, tendencias |
| 8.6 | **Multi-tenancy** | Single-tenant | Schema/DB por colegio |
| 8.7 | **Integración SIGE** | Standalone | APIs para sistemas escolares |

---

## Archivos Críticos a Modificar

### Backend
| Archivo | Fases |
|---------|-------|
| `app/services/attendance_notification_service.py` | 1.2 |
| `app/services/attendance_service.py` | 2.1, 5.2 |
| `app/services/photo_service.py` | 2.5 |
| `app/workers/jobs/send_whatsapp.py` | 1.3, 7.3 |
| `app/workers/jobs/detect_no_ingreso.py` | 2.6 |
| `app/api/v1/attendance.py` | 4.1 |
| `app/api/v1/kiosk.py` | 4.2 |
| `app/api/v1/absences.py` | 4.4 |
| `app/api/v1/alerts.py` | 4.4 |
| `app/api/v1/teachers.py` | 4.5 |
| `app/core/token_blacklist.py` | 2.7 |
| `app/db/repositories/notifications.py` | 4.6 |

### Frontend
| Archivo | Fases |
|---------|-------|
| `src/web-app/js/api.js` | 1.4, 4.3 |
| `src/web-app/js/state.js` | 1.6 |
| `src/web-app/js/views/parent_prefs.js` | 1.1 |
| `src/web-app/js/views/director_dashboard.js` | 5.1, 6.2 |
| `src/kiosk-app/js/views/scan_result.js` | 1.1, 2.2, 2.3, 5.3, 6.1 |
| `src/kiosk-app/js/state.js` | 1.5 |
| `src/kiosk-app/js/sync.js` | 2.4 |
| `src/kiosk-app/service-worker.js` | 5.4 |
| `src/teacher-pwa/js/api.js` | 4.3 |

### Infraestructura
| Archivo | Fases |
|---------|-------|
| `.github/workflows/ci.yml` | 3.1, 3.5, 3.6 |
| `.github/dependabot.yml` | 7.1 (nuevo) |
| `.pre-commit-config.yaml` | 7.2 |
| `app/db/migrations/versions/` | 3.4 |
| `docker-compose.yml` | 4.7 |
| `infra/docker-compose.yml` | 4.7 |
| `docs/` | 4.8 |

---

## Historial de Cambios

| Fecha | Versión | Descripción |
|-------|---------|-------------|
| 2025-12-01 | 2.0 | Auditoría completa, 55+ issues identificados |
| 2025-11-26 | 1.0 | Versión inicial, fases 1-4 completadas |

---

_Próxima revisión: Según avance de implementación_
