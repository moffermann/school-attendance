# Changelog - 20 de Diciembre 2025

## Actividades del Día

### 1. BRECHA CRÍTICA: App Kiosco Desconectada del Backend

### Severidad: ALTA

Durante pruebas del flujo de escaneo QR, se detectó que la **app de kiosco NO está conectada al backend real**. Esto significa que los códigos QR generados en el sistema de enrolamiento **NO FUNCIONAN** en la app de kiosco.

### Escenario de Prueba

1. Usuario enrola estudiante en web-app → Sistema genera código QR `qr_50_y4y5g9m6`
2. Usuario escanea código con lector QR del celular → Código válido
3. Usuario intenta usar código en app kiosco → **ERROR: Token no encontrado**

### Causa Raíz

La app de kiosco (`src/kiosk-app/`) usa **datos mock locales** en lugar de sincronizar con el backend:

**Archivo:** `src/kiosk-app/data/tags.json`
```json
[
  {"token": "nfc_001", "student_id": 1, "status": "ACTIVE"},
  {"token": "qr_011", "student_id": 11, "status": "ACTIVE"},
  // ... solo tokens hardcodeados de prueba
]
```

**Archivo:** `src/kiosk-app/js/state.js` (líneas 88-106)
```javascript
resolveByToken(token) {
  const tag = this.tags.find(t => t.token === token);
  if (!tag) return null;  // ← El código real NO existe en la lista mock
  // ...
}
```

### Componentes Afectados

| Componente | Estado | Descripción |
|------------|--------|-------------|
| `State.resolveByToken()` | Mock | Busca en datos locales hardcodeados |
| `State.updateTags()` | Implementado pero NO conectado | Método existe pero nunca se llama |
| `State.updateStudents()` | Implementado pero NO conectado | Método existe pero nunca se llama |
| `Sync.syncNow()` | Simulado | No hace llamadas HTTP reales |

### Flujo Actual vs Flujo Esperado

```
FLUJO ACTUAL (ROTO):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web App       │     │   Kiosk App     │     │   Backend API   │
│ Genera QR       │     │ Datos Mock      │     │ Tags Reales     │
│ qr_50_y4y5g9m6  │  ✗  │ qr_011, qr_012  │  ✗  │ qr_50_y4y5g9m6  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓
   Guardado en DB         NO sincroniza          Tags en PostgreSQL
                                ↓
                         "Token no encontrado"

FLUJO ESPERADO (A IMPLEMENTAR):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web App       │     │   Kiosk App     │     │   Backend API   │
│ Genera QR       │────→│ Sincroniza      │←────│ GET /kiosk/tags │
│ qr_50_y4y5g9m6  │     │ con Backend     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
   Guardado en DB      State.updateTags()       Retorna todos los
                       con datos reales         tags activos
                               ↓
                        "Estudiante encontrado"
```

### Endpoints de Backend YA Existentes

El backend ya tiene los endpoints necesarios implementados:

| Endpoint | Método | Descripción | Archivo |
|----------|--------|-------------|---------|
| `/api/v1/kiosk/provision` | POST | Provisionar dispositivo | `app/api/v1/kiosk.py` |
| `/api/v1/kiosk/sync` | POST | Sincronizar eventos | `app/api/v1/kiosk.py` |
| `/api/v1/kiosk/heartbeat` | POST | Latido del dispositivo | `app/api/v1/kiosk.py` |

**Falta implementar en frontend kiosk:**
- Llamar a estos endpoints en lugar de usar datos mock
- Sincronización periódica de tags/estudiantes
- Configuración de URL del servidor

### Archivos a Modificar para Corrección

| Archivo | Cambio Requerido |
|---------|------------------|
| `src/kiosk-app/js/sync.js` | Implementar llamadas HTTP reales a la API |
| `src/kiosk-app/js/state.js` | Llamar `updateTags()` después de sincronizar |
| `src/kiosk-app/js/views/settings.js` | Agregar configuración de URL del servidor |
| `src/kiosk-app/data/config.json` | Agregar `api_base_url` configurable |

### Impacto en Producción

**Sin esta corrección:**
- Los códigos QR/NFC generados en la web-app NO funcionarán en los kioscos
- Los kioscos solo reconocerán tokens hardcodeados de prueba
- El sistema de asistencia completo **NO ES FUNCIONAL** en su flujo principal

### Prioridad

**CRÍTICA** - Este es el flujo principal del producto. Sin esta conexión, el sistema no cumple su propósito fundamental.

### Próximos Pasos

1. **Conectar Sync.js al backend real** - Reemplazar simulación por llamadas HTTP
2. **Agregar configuración de servidor** - URL base configurable en settings
3. **Implementar sincronización inicial** - Al iniciar kiosco, sincronizar tags/estudiantes
4. **Sincronización periódica** - Cada N minutos, actualizar datos del servidor
5. **Manejo offline** - Mantener caché local para cuando no hay conexión


## 2. BRECHA CRÍTICA: Enrolamiento NFC No Guarda Tokens en Base de Datos

### Severidad: CRÍTICA

Durante el análisis del flujo de enrolamiento NFC, se detectó que el **frontend genera tokens localmente pero NUNCA los guarda en la base de datos**. Esto significa que los tags NFC escritos **NO FUNCIONARÁN** en ningún sistema que valide contra el backend.

### Escenario de Prueba

1. Usuario enrola estudiante en web-app → Sistema genera token `nfc_50_a1b2c3d4`
2. Token se escribe en tag NFC físico → Escritura exitosa
3. Usuario escanea tag en kiosco → **ERROR: Token no existe en sistema**

### Causa Raíz: DOS SISTEMAS DESCONECTADOS

Existen dos implementaciones de generación de tokens que **NO están conectadas**:

#### Sistema A: Frontend (Lo que se usa actualmente)

**Archivo:** `src/web-app/js/nfc-enrollment.js` (líneas 30-34)
```javascript
generateToken(type, id) {
  const prefix = type === 'student' ? 'nfc_' : 'nfc_teacher_';
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}${id}_${random}`;  // ← Generado localmente, NUNCA guardado en DB
}
```

**Problema:** Este token se escribe al tag NFC pero **NUNCA se envía al backend**.

#### Sistema B: Backend (Implementado pero NO usado)

**Archivo:** `app/services/tag_provision_service.py` (líneas 17-31)
```python
async def provision(self, payload: TagProvisionRequest) -> TagProvisionResponse:
    token = secrets.token_urlsafe(16)  # ← Token criptográficamente seguro
    tag_hash = hmac.new(settings.secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()
    preview = token[:8].upper()

    tag = await self.repository.create_pending(
        student_id=payload.student_id,
        tag_hash=tag_hash,
        tag_preview=preview,
    )
    await self.session.commit()  # ← Se guarda en PostgreSQL

    checksum = tag_hash[:12]
    ndef_uri = f"{settings.public_base_url}/t/{token}?sig={checksum}"
    return TagProvisionResponse(ndef_uri=ndef_uri, tag_token_preview=preview, checksum=checksum)
```

**Endpoints disponibles pero NO llamados:**

| Endpoint | Método | Descripción | Estado |
|----------|--------|-------------|--------|
| `/api/v1/tags/provision` | POST | Genera token seguro y guarda en DB | ✅ Implementado, ❌ No usado |
| `/api/v1/tags/confirm` | POST | Confirma que tag fue escrito | ✅ Implementado, ❌ No usado |
| `/api/v1/tags/{id}/revoke` | POST | Revoca un tag | ✅ Implementado |

### Comparación de Seguridad

| Aspecto | Frontend (Actual) | Backend (Correcto) |
|---------|-------------------|-------------------|
| Generador | `Math.random()` | `secrets.token_urlsafe(16)` |
| Seguridad | ❌ Predecible | ✅ Criptográficamente seguro |
| Verificación | ❌ Ninguna | ✅ HMAC-SHA256 con checksum |
| Persistencia | ❌ Solo en tag físico | ✅ PostgreSQL |
| Anti-falsificación | ❌ Ninguna | ✅ Firma criptográfica |

### Flujo Actual vs Flujo Esperado

```
FLUJO ACTUAL (ROTO):
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  1. generateToken() → "nfc_50_a1b2c3d4"                         │
│  2. writeToNFC(token) → Tag escrito ✅                          │
│  3. ??? → NUNCA llama al backend                                │
└─────────────────────────────────────────────────────────────────┘
         ↓ Tag físico tiene token
         ↓ Pero token NO existe en sistema
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
│  Tabla `tags`: vacía o sin este token                           │
│  Kiosco busca token → "No encontrado"                           │
└─────────────────────────────────────────────────────────────────┘

FLUJO ESPERADO (A CORREGIR):
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  1. API.provisionTag(student_id) → Backend genera token         │
│  2. Backend retorna: {ndef_uri, token_preview, checksum}        │
│  3. writeToNFC(ndef_uri) → Tag escrito ✅                       │
│  4. API.confirmTag(student_id, tag_uid) → Backend confirma      │
└─────────────────────────────────────────────────────────────────┘
         ↓ Tag físico tiene token seguro
         ↓ Token existe en PostgreSQL
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
│  Tabla `tags`: token guardado con hash y student_id             │
│  Kiosco busca token → "Estudiante encontrado" ✅                │
└─────────────────────────────────────────────────────────────────┘
```

### Archivos a Modificar para Corrección

| Archivo | Cambio Requerido |
|---------|------------------|
| `src/web-app/js/api.js` | Agregar métodos `provisionTag()` y `confirmTag()` |
| `src/web-app/js/nfc-enrollment.js` | Reemplazar `generateToken()` por llamadas a API |
| `src/web-app/js/nfc-enrollment.js` | En `writeTag()`, usar NDEF URI del backend |
| `src/web-app/js/nfc-enrollment.js` | Después de escritura exitosa, llamar `confirmTag()` |

### Impacto en Producción

**Sin esta corrección:**
- Los tags NFC enrollados **NO FUNCIONARÁN** en kioscos
- Los tokens escritos no existen en la base de datos
- Tokens generados con `Math.random()` son predecibles y pueden ser falsificados
- El flujo completo de enrolamiento NFC → asistencia está **COMPLETAMENTE ROTO**

### Relación con Brecha #1 (Kiosco Desconectado)

Esta brecha es **PREVIA** a la brecha del kiosco:

1. **Brecha #2 (Esta):** Token nunca se guarda en DB durante enrolamiento
2. **Brecha #1 (Kiosco):** Kiosco no sincroniza con backend

Incluso si corregimos la brecha #1 (kiosco sincroniza con backend), los tokens seguirían sin funcionar porque **nunca fueron guardados en primer lugar**.

### Prioridad

**MÁXIMA** - Esta brecha rompe el flujo fundamental del producto antes incluso que la brecha del kiosco.

### Próximos Pasos

1. **Agregar métodos API** - `provisionTag()` y `confirmTag()` en `api.js`
2. **Modificar enrolamiento** - Llamar backend antes de escribir tag
3. **Usar NDEF URI del backend** - El backend genera URI con firma de seguridad
4. **Confirmar escritura** - Después de escribir tag, llamar `confirmTag()`
5. **Manejar errores** - Si falla escritura, el tag queda en estado PENDING

---

## 3. Análisis: Módulo de Eventos Especiales (FASE 2)

> **NOTA:** Este análisis se documenta para consideración futura. **NO se implementará en esta fase** del proyecto. Se evaluará su inclusión una vez el sistema esté en producción y se tenga feedback real de clientes.

### Contexto

Durante la revisión del módulo de horarios, surgió la pregunta: *¿Qué pasa si la escuela tiene un evento especial un sábado o domingo (competencia deportiva, obra de teatro, examen especial)?*

### Brecha Funcional Identificada

El sistema actual tiene limitaciones para manejar eventos fuera del horario regular:

| Módulo Actual | Propósito | Limitación |
|---------------|-----------|------------|
| **Schedule** | Horarios regulares L-V | No cubre fines de semana |
| **ScheduleException** | Modificar/cancelar horarios existentes | Solo altera lo que ya existe, no crea nuevos |
| **AttendanceEvent** | Registro de entrada/salida | Sin contexto del "evento" al que se asiste |

### Escenario de Ejemplo

```
Sábado 21 de Diciembre
Competencia Deportiva Inter-escolar
Horario: 09:00 - 14:00
Participan: 5° y 6° Básico

Necesidades:
1. Alumnos marcan entrada/salida    → Funciona (hardware)
2. Validar si llegó a tiempo        → NO HAY horario de referencia
3. Padres ven "asistió a [Evento]"  → Solo ven "entrada" genérica
4. Reporte de asistencia al evento  → No hay forma de filtrar
```

### Solución Propuesta (Para Fase 2)

#### Nuevo modelo: `SpecialEvent`

```sql
-- Tabla principal de eventos especiales
CREATE TABLE special_events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(32) NOT NULL,  -- DEPORTIVO, CULTURAL, ACADEMICO, OTRO
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(200),
    scope VARCHAR(16) NOT NULL,       -- GLOBAL, COURSE, CUSTOM
    attendance_required BOOLEAN DEFAULT false,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos participantes (cuando scope = COURSE)
CREATE TABLE special_event_courses (
    event_id INTEGER REFERENCES special_events(id),
    course_id INTEGER REFERENCES courses(id),
    PRIMARY KEY (event_id, course_id)
);

-- Estudiantes específicos (cuando scope = CUSTOM)
CREATE TABLE special_event_students (
    event_id INTEGER REFERENCES special_events(id),
    student_id INTEGER REFERENCES students(id),
    status VARCHAR(16) DEFAULT 'INVITED',  -- INVITED, CONFIRMED, DECLINED
    PRIMARY KEY (event_id, student_id)
);

-- Vincular asistencia con eventos especiales
ALTER TABLE attendance_events
ADD COLUMN special_event_id INTEGER REFERENCES special_events(id);
```

#### Beneficios Potenciales

| Funcionalidad | Descripción |
|---------------|-------------|
| Horarios flexibles | Cualquier día/hora, incluyendo fines de semana |
| Participantes específicos | Global, por curso, o selección manual |
| Contexto en asistencia | Padres verían "Tu hijo asistió a Competencia de Atletismo" |
| Reportes por evento | Lista de asistencia específica del evento |
| Validación de puntualidad | Comparar hora de llegada vs hora inicio del evento |

### Decisión

**NO IMPLEMENTAR EN ESTA FASE**

**Justificación:**
- El sistema aún no está en producción
- No hay clientes reales que confirmen la necesidad
- Es mejor esperar feedback real de escuelas sobre frecuencia de eventos especiales
- Evitar sobre-ingeniería antes de validar el caso de uso

**Próximos pasos:**
1. Lanzar sistema a producción con funcionalidad actual
2. Recopilar feedback de escuelas sobre necesidades de eventos especiales
3. Evaluar frecuencia y tipos de eventos que manejan
4. Si hay demanda real, planificar implementación para Fase 2

---

## Archivos Creados/Modificados

| Archivo | Acción |
|---------|--------|
| `docs/changelog/2025-12-20-special-events-analysis.md` | Creado y actualizado |

---

## Notas

### Orden de Prioridad para Correcciones

| # | Brecha | Severidad | Impacto |
|---|--------|-----------|---------|
| 1 | Kiosco desconectado del backend | ALTA | Kiosco no reconoce tokens reales |
| 2 | Enrolamiento NFC no guarda en DB | CRÍTICA | Tokens nunca llegan a existir |
| 3 | Eventos especiales | BAJA | Funcionalidad futura |

**Orden de corrección recomendado:** Brecha #2 → Brecha #1 → (Brecha #3 solo si hay demanda)

### Brecha #2: Enrolamiento NFC
Esta es la brecha **más crítica** porque rompe el flujo en el origen. Aunque el kiosco estuviera conectado al backend, no encontraría los tokens porque nunca fueron guardados. Esta corrección es **pre-requisito** para que la corrección del kiosco tenga sentido.

### Brecha #1: Kiosco-Backend
Esta brecha funcional debe ser corregida **DESPUÉS** de la brecha #2. Una vez que los tokens se guarden correctamente en la DB durante el enrolamiento, el kiosco podrá sincronizarlos y reconocerlos.

### Análisis de Eventos Especiales
Este documento sirve como registro del análisis realizado y la decisión de postergar el desarrollo. Cuando el sistema esté en producción y se tenga feedback de clientes, se puede retomar este análisis como punto de partida.
