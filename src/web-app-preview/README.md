# Web App - Control de Ingreso/Salida Escolar

Maqueta navegable (solo vistas) para **Dirección/Inspectoría** y **Padres**.

## Características

- **SPA** con hash routing (`#/ruta`)
- **Datos mock** en `/data/*.json` con persistencia en `localStorage`
- **Navegación completa** entre roles (Director/Inspector/Padre)
- **Responsive** (móvil → escritorio)
- **Sin dependencias externas** (HTML/CSS/JS vanilla)

## Cómo usar

### Opción 1: Servidor local con npx

```bash
npx serve . -p 5173
```

Luego abrir: `http://localhost:5173`

### Opción 2: Abrir directamente

Hacer doble clic en `index.html` (funciona en la mayoría de navegadores modernos).

## Flujo de uso

1. **Inicio**: Al abrir la app, verás la pantalla de autenticación (`#/auth`)
2. **Seleccionar rol**:
   - **Dirección/Inspectoría**: Podrás elegir entre Director o Inspector y acceder a todas las vistas administrativas
   - **Apoderado**: Seleccionar un apoderado de la lista para ver el estado de sus hijos

### Roles y vistas disponibles

#### Dirección/Inspectoría

- **Tablero** (`#/director/dashboard`): Vista en vivo de ingresos/salidas del día con filtros
- **Reportes** (`#/director/reports`): Resumen por curso con gráficas
- **Horarios** (`#/director/schedules`): Editor de horarios base por curso y día
- **Excepciones** (`#/director/exceptions`): Crear excepciones de calendario (jornada reducida, etc.)
- **Broadcast** (`#/director/broadcast`): Envío masivo de mensajes (simulado)
- **Dispositivos** (`#/director/devices`): Estado de puertas/kioscos, batería, sincronización
- **Alumnos** (`#/director/students`): Lista de alumnos con búsqueda y filtros
- **Ausencias** (`#/director/absences`): Bandeja de solicitudes (aprobar/rechazar)

#### Apoderados

- **Estado de Hoy** (`#/parent/home`): Resumen de ingreso/salida por cada hijo
- **Historial** (`#/parent/history`): Eventos históricos con filtros por fecha
- **Preferencias** (`#/parent/prefs`): Configurar canales de notificación y opt-in de foto
- **Ausencias** (`#/parent/absences`): Solicitar ausencias con adjuntos (simulado)

## Datos mock

Los archivos JSON en `/data/` contienen:

- **students.json**: 60 alumnos distribuidos en 3 cursos
- **courses.json**: 1ºA, 1ºB, 2ºA
- **guardians.json**: 10 apoderados con 1-2 hijos cada uno
- **attendance_events.json**: Eventos de ingreso/salida del día
- **schedules.json**: Horarios base por curso
- **schedule_exceptions.json**: Excepciones de calendario
- **devices.json**: 3 dispositivos de entrada
- **absences.json**: Solicitudes de ausencia
- **notifications.json**: Notificaciones enviadas

### Persistencia

Los cambios realizados en la UI (crear excepciones, aprobar ausencias, etc.) se guardan en `localStorage`. Para resetear los datos:

```javascript
localStorage.clear();
location.reload();
```

## Interacciones simuladas

- **Toasts**: Notificaciones de éxito/error al guardar cambios
- **Modals**: Confirmaciones y formularios
- **Filtros**: Client-side sin recarga de página
- **Paginación**: Tablas con más de 20 items
- **Validación**: Campos requeridos en formularios
- **Broadcast**: Vista previa de destinatarios y reporte de envío simulado
- **Gráficas**: Dibujadas con Canvas (barras y líneas)

## Limitaciones

- **Sin backend**: Todos los datos son locales
- **Sin autenticación real**: Solo selección de rol
- **Sin subida de archivos**: Los adjuntos solo guardan el nombre
- **Sin notificaciones reales**: WhatsApp/Email son placeholders
- **Sin cámara/NFC**: Las fotos de evidencia son placeholders

## Estructura del código

```
web-app/
├── index.html              # Punto de entrada
├── css/
│   └── styles.css         # Estilos globales
├── js/
│   ├── router.js          # Navegación hash-based
│   ├── state.js           # Estado global + localStorage
│   ├── components.js      # Componentes UI reutilizables
│   └── views/             # Vistas por rol
│       ├── auth.js
│       ├── director_*.js  # 8 vistas de dirección
│       └── parent_*.js    # 4 vistas de padres
├── data/                  # Datos mock en JSON
└── assets/                # Logo e imágenes placeholder
```

## Rutas completas

| Ruta | Descripción | Roles |
|------|-------------|-------|
| `#/auth` | Inicio de sesión | Todos |
| `#/director/dashboard` | Tablero en vivo | Director, Inspector |
| `#/director/reports` | Reportes | Director, Inspector |
| `#/director/schedules` | Horarios base | Director, Inspector |
| `#/director/exceptions` | Excepciones | Director, Inspector |
| `#/director/broadcast` | Broadcast masivo | Director, Inspector |
| `#/director/devices` | Dispositivos | Director, Inspector |
| `#/director/students` | Alumnos | Director, Inspector |
| `#/director/absences` | Ausencias | Director, Inspector |
| `#/parent/home` | Estado de hoy | Padre |
| `#/parent/history` | Historial | Padre |
| `#/parent/prefs` | Preferencias | Padre |
| `#/parent/absences` | Ausencias | Padre |

## Notas de accesibilidad

- Navegación por teclado
- Roles ARIA en menús
- Labels en formularios
- Focus visible
- Contraste AA

## Próximos pasos (fuera del alcance de esta maqueta)

- Integración con backend real
- Autenticación y autorización
- Notificaciones push
- Integración con WhatsApp Business API
- Captura real de fotos (WebRTC)
- Soporte NFC/QR real
- Exportación CSV real
- Tests automatizados
