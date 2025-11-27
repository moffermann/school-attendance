# School Attendance - Roadmap Integral
**Fecha:** 2025-11-26
**Análisis completo del proyecto**

---

## Resumen Ejecutivo

Este documento consolida el análisis de bugs, mejoras críticas y plan de trabajo para todo el sistema de asistencia escolar, incluyendo:

- **Backend FastAPI** (Python)
- **Kiosk App** (Vanilla JS - tablets)
- **Teacher PWA** (Vanilla JS - profesores)
- **Web App** (Director Dashboard - SPA)

---

## 1. BUGS CRÍTICOS (Corregir Inmediatamente)

### 1.1 Backend - Seguridad

| # | Archivo | Línea | Bug | Severidad |
|---|---------|-------|-----|-----------|
| B1 | `app/core/config.py` | 11, 18 | **Secret keys con defaults débiles** - `"dev-secret"` y `"device-secret"` como valores por defecto | CRÍTICO |
| B2 | `app/services/dashboard_service.py` | ~65 | **SQL Injection potencial** en búsqueda LIKE sin escapar caracteres especiales | CRÍTICO |
| B3 | `app/api/v1/attendance.py` | 37-45 | **Upload de archivos sin validación** - Sin verificar MIME type, tamaño máximo, ni extensión | CRÍTICO |
| B4 | `app/api/v1/absences.py` | 45-63 | **Bypass de autorización** - Crea fake AuthUser con role=ADMIN para exportar | CRÍTICO |

### 1.2 Backend - Bugs de Código

| # | Archivo | Línea | Bug | Severidad |
|---|---------|-------|-----|-----------|
| B5 | `app/services/absence_service.py` | 68 | **Error de lógica** - `if` debería ser `elif`, sobrescribe records de admin | ALTO |
| B6 | `app/api/v1/broadcast.py` | 32 | **Import faltante** - `HTTPException` no importado pero usado | MEDIO |
| B7 | `app/services/notification_service.py` | ~25 | **Import faltante** - `datetime` en type hints | MEDIO |
| B8 | `app/services/absence_service.py` | 1 | **Import faltante** - `date` en type hints | MEDIO |

### 1.3 Frontend - XSS Vulnerabilities

| # | Archivo | Línea | Bug | Severidad |
|---|---------|-------|-----|-----------|
| B9 | `src/web-app/js/components.js` | 8-11, 40-55 | **XSS** - HTML sin escapar en `showToast()` y `showModal()` | CRÍTICO |
| B10 | `src/teacher-pwa/js/views/roster.js` | múltiples | **XSS** - Nombres de estudiantes sin escapar | CRÍTICO |
| B11 | `src/web-app/js/views/parent_history.js` | 21 | **Acceso no autorizado** - Guardian puede ver datos de otros hijos vía URL | CRÍTICO |

### 1.4 Frontend - Autenticación

| # | Archivo | Línea | Bug | Severidad |
|---|---------|-------|-----|-----------|
| B12 | `src/web-app/js/router.js` | 36-37, 44-52 | **Auth bypass** - Role leído de localStorage sin validar | CRÍTICO |
| B13 | `src/teacher-pwa/js/sync.js` | múltiples | **Sync simulado** - 85% fake success rate, no hay backend real | CRÍTICO |

---

## 2. MEJORAS DE SEGURIDAD (Prioridad Alta)

### 2.1 Backend

| # | Mejora | Archivo | Descripción |
|---|--------|---------|-------------|
| S1 | Secrets obligatorios | `config.py` | Cambiar defaults a `Field(...)` (requerido) |
| S2 | Validación de uploads | `attendance.py` | MIME types permitidos, tamaño máximo 10MB, extensiones whitelist |
| S3 | CORS restrictivo | `main.py` | Limitar origins, methods y headers específicos |
| S4 | Rate limiting | `main.py` | Agregar slowapi o similar para prevenir DoS |
| S5 | Device keys por dispositivo | `config.py` | Implementar keys individuales con rotación |

### 2.2 Frontend

| # | Mejora | Archivo | Descripción |
|---|--------|---------|-------------|
| S6 | HTML escaping | `components.js` | Crear función `escapeHtml()` y usar en todos los renders |
| S7 | Token validation | `router.js` | Validar sesión contra backend en cada navegación |
| S8 | CSRF tokens | `sync.js` | Agregar soporte para CSRF en requests |
| S9 | Secure storage | `state.js` | No guardar datos sensibles en localStorage |

---

## 3. RACE CONDITIONS Y CONCURRENCIA

| # | Archivo | Línea | Problema | Solución |
|---|---------|-------|----------|----------|
| C1 | `app/db/repositories/tags.py` | 22-27 | Race condition en confirmación de tag | Usar `SELECT FOR UPDATE` |
| C2 | `app/services/attendance_service.py` | 63-85 | Alertas duplicadas si 2 workers corren | Unique constraint + `INSERT ON CONFLICT` |
| C3 | `app/db/repositories/devices.py` | 20-42 | Upsert no atómico | Usar `ON CONFLICT DO UPDATE` |
| C4 | `src/teacher-pwa/js/state.js` | enqueueEvent | localStorage race condition | Usar mutex o IDB transactions |

---

## 4. PROBLEMAS DE PERFORMANCE

| # | Archivo | Problema | Solución |
|---|---------|----------|----------|
| P1 | `app/services/attendance_service.py:52-89` | N+1 queries en schedules | Eager loading con `selectinload()` |
| P2 | Modelos de DB | Faltan índices en `student_id`, `occurred_at` | Agregar `index=True` |
| P3 | `app/db/repositories/attendance.py` | Sin límite máximo de paginación | `limit = min(limit, 500)` |
| P4 | `src/teacher-pwa/js/views/*.js` | Full IDB scan en cada navegación | Implementar caching en memoria |

---

## 5. ERROR HANDLING

| # | Archivo | Problema | Solución |
|---|---------|----------|----------|
| E1 | Múltiples servicios | `except Exception:` genérico | Catches específicos (`IntegrityError`, `OperationalError`) |
| E2 | `app/services/attendance_service.py:33` | `session.commit()` sin try-catch | Manejar errores de DB explícitamente |
| E3 | `src/teacher-pwa/js/idb.js` | Sin `onerror` en transactions | Agregar error handlers |
| E4 | `src/teacher-pwa/service-worker.js` | `cache.addAll()` falla si un archivo 404 | Agregar fallback parcial |

---

## 6. TEST COVERAGE GAPS

### 6.1 Backend (Crítico - ~30% cobertura actual)

| Área | Estado | Prioridad |
|------|--------|-----------|
| Repositories (12 archivos) | **0% tests** | CRÍTICA |
| API Endpoints (12 archivos) | **30% tests** | CRÍTICA |
| Services (17 archivos) | **40% tests** | CRÍTICA |
| Auth/Security | **10% tests** | CRÍTICA |

### 6.2 Frontend

| App | Estado | Prioridad |
|-----|--------|-----------|
| Kiosk App | ~30 E2E tests, 0 unit tests | ALTA |
| Teacher PWA | **0 tests** | CRÍTICA |
| Web App | **0 tests** | CRÍTICA |

---

## 7. PLAN DE TRABAJO POR FASES

### FASE 1: Estabilización Crítica (1-2 semanas)

**Objetivo:** Corregir todos los bugs de seguridad y crashes

#### 1.1 Seguridad Backend
- [ ] B1: Eliminar defaults de secrets en config.py
- [ ] B2: Escapar caracteres LIKE en dashboard_service.py
- [ ] B3: Validar uploads (MIME, size, extension)
- [ ] B4: Corregir bypass de auth en absences export
- [ ] S1-S5: Implementar mejoras de seguridad

#### 1.2 Bugs de Código Backend
- [ ] B5: Corregir `if` → `elif` en absence_service.py
- [ ] B6: Agregar import HTTPException en broadcast.py
- [ ] B7: Agregar import datetime en notification_service.py
- [ ] B8: Agregar import date en absence_service.py

#### 1.3 Seguridad Frontend
- [ ] B9-B10: Crear y usar `escapeHtml()` en todos los frontends
- [ ] B11: Validar acceso de guardian a estudiantes
- [ ] B12: Validar tokens contra backend
- [ ] S6-S9: Implementar mejoras de seguridad frontend

### FASE 2: Integridad de Datos (1-2 semanas)

**Objetivo:** Resolver race conditions y mejorar performance

#### 2.1 Concurrencia
- [ ] C1: SELECT FOR UPDATE en tags
- [ ] C2: Unique constraint para alertas
- [ ] C3: Upsert atómico para devices
- [ ] C4: Mutex en teacher-pwa state

#### 2.2 Performance
- [ ] P1: Eager loading en attendance_service
- [ ] P2: Agregar índices a modelos
- [ ] P3: Límite máximo de paginación
- [ ] P4: Caching en teacher-pwa

#### 2.3 Error Handling
- [ ] E1-E4: Mejorar manejo de errores en backend y frontend

### FASE 3: Test Coverage (2-3 semanas)

**Objetivo:** Alcanzar 70%+ cobertura en áreas críticas

#### 3.1 Backend Tests
- [ ] Tests para todos los repositories
- [ ] Tests de integración para API endpoints
- [ ] Tests de seguridad/auth
- [ ] Tests de servicios faltantes

#### 3.2 Frontend Tests
- [ ] Unit tests para state.js y sync.js (kiosk)
- [ ] E2E tests para teacher-pwa
- [ ] E2E tests para web-app
- [ ] Tests de offline/sync

### FASE 4: Integración Real (2-3 semanas)

**Objetivo:** Conectar frontends con backend real

#### 4.1 Teacher PWA → Backend
- [x] Reemplazar sync simulado con API real
- [x] Implementar autenticación JWT
- [x] Agregar endpoints de profesor (`/teachers/courses`, `/attendance/bulk`)
- [ ] Manejo offline/online con reconciliación

#### 4.2 Web App → Backend
- [x] Validar sesión en cada request
- [x] Eliminar datos mock restantes
- [x] Implementar role-based data filtering

#### 4.3 Kiosk App → Backend
- [x] Ya tiene integración (Fase 4 completada)
- [ ] Agregar provisioning script
- [ ] Documentar rotación de device keys

### FASE 4.5: Testing E2E Integral (1-2 semanas)

**Objetivo:** Tests E2E completos contra backend real en dev

**Estado:** EN PROGRESO (2025-11-27)

#### 4.5.1 Configuración
- [ ] Configurar Playwright para apuntar a `school-attendance.dev.gocode.cl`
- [ ] Crear fixtures con usuarios de prueba reales (director, inspector, parent, teacher)
- [ ] Configurar CI para ejecutar tests contra entorno dev

#### 4.5.2 Web App E2E Tests
- [ ] Login/logout con credenciales reales
- [ ] Dashboard director: métricas, estudiantes, cursos
- [ ] Vista de apoderado: historial de hijo
- [ ] Navegación entre roles

#### 4.5.3 Teacher PWA E2E Tests
- [ ] Login con usuario profesor
- [ ] Listado de cursos asignados
- [ ] Toma de asistencia de curso
- [ ] Sincronización de datos

#### 4.5.4 Kiosk App E2E Tests
- [ ] Configuración inicial (device provisioning)
- [ ] Escaneo de tag y registro de entrada/salida
- [ ] Modo offline y sincronización
- [ ] Vista de administrador

#### 4.5.5 Tests de Integración Cross-App
- [ ] Flujo completo: Kiosk registra entrada → Director ve en dashboard
- [ ] Profesor toma asistencia → Parent ve en historial
- [ ] Alertas de no ingreso end-to-end

### FASE 5: Features Nuevos (Ongoing)

#### 5.1 Portal Web
- [ ] Métricas extendidas de ausencias
- [ ] Bitácora de notificaciones con export
- [ ] Reportes PDF semanales
- [ ] Estados vacíos/errores coherentes

#### 5.2 Kiosk
- [ ] Biometric integration (futuro)
- [ ] NFC real con hardware (vs Web NFC)
- [ ] Multi-idioma

#### 5.3 PWA Profesores
- [ ] Toma de asistencia masiva
- [ ] Historial por clase
- [ ] Alertas de no ingreso

---

## 8. DEUDA TÉCNICA

### 8.1 Arquitectura
| Item | Descripción | Impacto |
|------|-------------|---------|
| Frontends sin framework | Vanilla JS difícil de mantener | Alto |
| Sin TypeScript | Errores de tipos en runtime | Medio |
| Mock data dispersa | 3 copias de datos en `data/` | Bajo |

### 8.2 Documentación
| Item | Estado |
|------|--------|
| API docs (OpenAPI) | Parcial - falta documentar responses |
| Deployment guide | Existe pero incompleto |
| Architecture decision records | No existe |

### 8.3 DevOps
| Item | Estado |
|------|--------|
| CI/CD | GitHub Actions básico |
| Staging environment | No existe |
| Monitoring/Alerting | No existe |
| Log aggregation | No existe |

---

## 9. MATRIZ DE PRIORIDADES

```
                    IMPACTO
                 Alto    Bajo
              ┌────────┬────────┐
        Alta  │ HACER  │ QUICK  │
URGENCIA      │ AHORA  │ WINS   │
              ├────────┼────────┤
        Baja  │ PLAN   │ BACK   │
              │ AHEAD  │ LOG    │
              └────────┴────────┘

HACER AHORA (Alta urgencia, Alto impacto):
- B1-B4: Bugs de seguridad críticos
- B9-B12: XSS y auth bypass
- C1-C2: Race conditions en datos

QUICK WINS (Alta urgencia, Bajo impacto):
- B5-B8: Imports faltantes
- E1-E4: Error handling básico

PLAN AHEAD (Baja urgencia, Alto impacto):
- Test coverage completo
- Integración real de PWAs
- Migración a framework (React/Vue)

BACKLOG (Baja urgencia, Bajo impacto):
- Multi-idioma
- Biometrics
- PDF reports
```

---

## 10. MÉTRICAS DE ÉXITO

| Métrica | Actual | Meta Fase 3 | Meta Final |
|---------|--------|-------------|------------|
| Bugs críticos | 13 | 0 | 0 |
| Test coverage backend | ~30% | 70% | 85% |
| Test coverage frontend | ~10% | 50% | 70% |
| Security vulnerabilities | 9 | 0 | 0 |
| Performance issues | 4 | 1 | 0 |

---

## 11. DEPENDENCIAS ENTRE FASES

```
Fase 1 (Seguridad) ─────┐
                        ├──► Fase 3 (Tests) ──► Fase 5 (Features)
Fase 2 (Integridad) ────┘         │
                                  │
                                  ▼
                          Fase 4 (Integración)
```

**Nota:** Fase 1 y 2 pueden ejecutarse en paralelo. Fase 3 requiere que 1 y 2 estén completas. Fase 4 puede iniciar cuando Fase 3 esté al 50%.

---

## 12. ARCHIVOS CLAVE POR COMPONENTE

### Backend
```
app/
├── core/config.py          # Configuración (CRÍTICO - secrets)
├── core/security.py        # Auth/JWT
├── api/v1/attendance.py    # Endpoints asistencia
├── api/v1/absences.py      # Endpoints ausencias
├── services/attendance_service.py  # Lógica core
├── services/dashboard_service.py   # SQL injection risk
└── db/repositories/*.py    # Data access layer
```

### Kiosk App
```
src/kiosk-app/
├── js/state.js            # Estado central
├── js/sync.js             # Sincronización (ya integrado)
├── js/views/home.js       # QR/NFC scanning
└── service-worker.js      # Offline support
```

### Teacher PWA
```
src/teacher-pwa/
├── js/state.js            # Estado (sin validación)
├── js/sync.js             # Sync simulado (CRÍTICO)
├── js/idb.js              # IndexedDB
└── js/views/roster.js     # XSS vulnerability
```

### Web App
```
src/web-app/
├── js/router.js           # Auth bypass risk
├── js/components.js       # XSS vulnerabilities
├── js/state.js            # No server validation
└── js/views/parent_*.js   # Authorization issues
```

---

_Documento generado: 2025-11-26_
_Próxima revisión: Completar Fase 1_
