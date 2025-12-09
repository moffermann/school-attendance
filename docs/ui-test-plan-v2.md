# Plan de Pruebas UI v2 - Sistema de Asistencia Escolar

**Version:** 2.0
**Fecha:** 2025-12-08
**Ambiente:** https://school-attendance.dev.gocode.cl

---

## Resumen de Cobertura

| Fase | Rol | Aplicacion | Casos | Prioridad |
|------|-----|------------|-------|-----------|
| 1 | Kiosk (Dispositivo) | kiosk-app | 20 casos | Critica |
| 2 | Director/Inspector | web-app | 35 casos | Alta |
| 3 | Apoderado (Parent) | web-app | 18 casos | Alta |
| 4 | Profesor | teacher-pwa | 22 casos | Alta |
| 5 | Super Admin | web-app | 15 casos | Media |
| 6 | Multi-Tenant | cross-app | 10 casos | Critica |
| 7 | Seguridad | cross-app | 12 casos | Critica |
| 8 | Performance | cross-app | 8 casos | Media |

**Total: 140 casos de prueba**

---

## URLs de Prueba

| Aplicacion | URL | Autenticacion |
|------------|-----|---------------|
| Kiosk | https://school-attendance.dev.gocode.cl/kiosk | Device Key |
| Web App | https://school-attendance.dev.gocode.cl/app | JWT Token |
| Teacher PWA | https://school-attendance.dev.gocode.cl/teacher | JWT Token |
| Super Admin | https://school-attendance.dev.gocode.cl/app/#/super-admin/auth | JWT (Super) |

---

## Credenciales de Prueba

| Rol | Email | Password |
|-----|-------|----------|
| Director | director@colegio-demo.cl | Demo123! |
| Inspector | inspector@colegio-demo.cl | Demo123! |
| Super Admin | admin@gocode.cl | Demo123! |
| Apoderado 1-5 | apoderado1@colegio-demo.cl | Demo123! |
| Profesor (Demo) | Botones demo en UI | N/A |

---

# FASE 1: KIOSK (20 casos)

## 1.1 Configuracion y Bootstrap

### TC-K01: Primera configuracion del kiosk
**Severidad:** Critica
**Precondiciones:** localStorage vacio
**Pasos:**
1. Abrir https://school-attendance.dev.gocode.cl/kiosk
2. Verificar redireccion a /settings
3. Configurar Gate ID, Device ID
4. Guardar configuracion
**Resultado Esperado:** Redireccion a /home con datos sincronizados

### TC-K02: Bootstrap API retorna datos de tenant correcto
**Severidad:** Critica
**Pasos:**
1. Configurar kiosk con Device Key valido
2. Verificar llamada a /api/v1/kiosk/bootstrap
3. Inspeccionar response
**Resultado Esperado:** 60 estudiantes, 3 profesores del tenant demo

### TC-K03: Sincronizacion periodica de estudiantes
**Severidad:** Alta
**Pasos:**
1. Esperar 5 minutos
2. Verificar llamada a /api/v1/kiosk/students
**Resultado Esperado:** Preferencias de foto actualizadas

---

## 1.2 Escaneo QR/NFC

### TC-K04: Registro de entrada con token valido
**Severidad:** Critica
**Pasos:**
1. En /home, usar input manual o QR scanner
2. Ingresar token de estudiante
3. Verificar evento creado
**Resultado Esperado:**
- Pantalla de bienvenida
- Evento tipo IN registrado
- Sonido de confirmacion

### TC-K05: Registro de salida (toggle automatico)
**Severidad:** Critica
**Precondiciones:** Estudiante con entrada registrada hoy
**Pasos:**
1. Escanear mismo token
**Resultado Esperado:** Evento tipo OUT registrado

### TC-K06: Token invalido
**Severidad:** Alta
**Pasos:**
1. Ingresar token inexistente: `invalid_token_xyz`
**Resultado Esperado:** Toast de error, sin registro

### TC-K07: Token revocado
**Severidad:** Alta
**Pasos:**
1. Usar token con status REVOKED
**Resultado Esperado:** Mensaje "Credencial revocada"

### TC-K08: Escaneo de credencial de profesor
**Severidad:** Media
**Pasos:**
1. Escanear token de profesor
**Resultado Esperado:** Redireccion a panel admin

---

## 1.3 Captura de Evidencia

### TC-K09: Foto capturada con consentimiento
**Severidad:** Alta
**Precondiciones:** Estudiante con photo_opt_in=true
**Pasos:**
1. Escanear token
2. Verificar activacion de camara
3. Confirmar registro
**Resultado Esperado:** Foto adjunta al evento

### TC-K10: Sin captura por falta de consentimiento
**Severidad:** Alta
**Precondiciones:** Estudiante con photo_opt_in=false
**Pasos:**
1. Escanear token
**Resultado Esperado:** Camara NO se activa

### TC-K11: Audio como evidencia alternativa
**Severidad:** Media
**Precondiciones:** evidence_preference=audio
**Pasos:**
1. Escanear token
2. Grabar audio
3. Confirmar
**Resultado Esperado:** Audio adjunto al evento

---

## 1.4 Autenticacion Biometrica

### TC-K12: Autenticacion por huella digital
**Severidad:** Alta
**Precondiciones:** Estudiante con WebAuthn credential
**Pasos:**
1. Clic en "Usa tu huella"
2. Autenticar con biometrico
**Resultado Esperado:** Identificacion exitosa, registro de asistencia

### TC-K13: Huella no reconocida
**Severidad:** Media
**Pasos:**
1. Intentar autenticacion sin credential registrada
**Resultado Esperado:** Error "No se pudo identificar"

### TC-K14: Dispositivo sin soporte biometrico
**Severidad:** Baja
**Precondiciones:** Navegador sin WebAuthn
**Pasos:**
1. Intentar acceder a biometric auth
**Resultado Esperado:** Mensaje de no soportado

---

## 1.5 Cola de Sincronizacion

### TC-K15: Eventos encolados en modo offline
**Severidad:** Critica
**Pasos:**
1. Simular offline
2. Registrar 3 eventos
3. Verificar cola local
**Resultado Esperado:** Eventos con status=pending

### TC-K16: Sincronizacion automatica al reconectar
**Severidad:** Alta
**Pasos:**
1. Tener eventos pendientes
2. Restaurar conexion
3. Esperar 30 segundos
**Resultado Esperado:** Eventos sincronizados

### TC-K17: Reintento de foto fallida
**Severidad:** Media
**Precondiciones:** Evento con photo_data y status=partial_sync
**Pasos:**
1. Verificar cola
2. Esperar reintento
**Resultado Esperado:** Hasta 3 reintentos de subida

---

## 1.6 Panel Administrativo

### TC-K18: Timeout de sesion de profesor
**Severidad:** Media
**Pasos:**
1. Autenticarse como profesor
2. Esperar 5 minutos sin actividad
**Resultado Esperado:** Sesion expira, redireccion a home

### TC-K19: Registro biometrico de estudiante
**Severidad:** Alta
**Precondiciones:** Profesor autenticado
**Pasos:**
1. Ir a registro biometrico
2. Buscar estudiante
3. Registrar huella
**Resultado Esperado:** Credencial WebAuthn creada

### TC-K20: Visualizacion de cola de sincronizacion
**Severidad:** Baja
**Pasos:**
1. Ir a /queue
2. Verificar tabs y contadores
**Resultado Esperado:** Vista correcta de eventos por estado

---

# FASE 2: DIRECTOR/INSPECTOR (35 casos)

## 2.1 Autenticacion

### TC-D01: Login con credenciales validas
**Severidad:** Critica
**Pasos:**
1. Navegar a /app
2. Seleccionar "Direccion / Inspectoria"
3. Ingresar director@colegio-demo.cl / Demo123!
**Resultado Esperado:** Acceso a dashboard

### TC-D02: Login modo demo
**Severidad:** Alta
**Pasos:**
1. Clic en boton "Director" demo
**Resultado Esperado:** Acceso inmediato con datos de prueba

### TC-D03: Login fallido
**Severidad:** Alta
**Pasos:**
1. Credenciales incorrectas
**Resultado Esperado:** Mensaje de error claro

### TC-D04: Logout limpia sesion
**Severidad:** Media
**Pasos:**
1. Clic en Cerrar sesion
2. Intentar navegar a ruta protegida
**Resultado Esperado:** Redireccion a login

---

## 2.2 Dashboard en Vivo

### TC-D05: Estadisticas del dia actuales
**Severidad:** Critica
**Pasos:**
1. Verificar tarjetas de resumen
**Resultado Esperado:** Ingresos, Salidas, Atrasos, Sin Ingreso

### TC-D06: Filtrado por curso
**Severidad:** Alta
**Pasos:**
1. Seleccionar curso especifico
2. Aplicar filtro
**Resultado Esperado:** Solo eventos de ese curso

### TC-D07: Filtrado por tipo de evento
**Severidad:** Alta
**Pasos:**
1. Seleccionar "Ingreso" o "Salida"
2. Aplicar filtro
**Resultado Esperado:** Solo eventos del tipo seleccionado

### TC-D08: Busqueda por nombre de alumno
**Severidad:** Media
**Pasos:**
1. Escribir nombre parcial
2. Verificar resultados
**Resultado Esperado:** Eventos filtrados por nombre

### TC-D09: Exportacion CSV
**Severidad:** Media
**Pasos:**
1. Configurar filtros
2. Clic en "Exportar CSV"
**Resultado Esperado:** Descarga de archivo CSV

### TC-D10: Ver fotos de evidencia
**Severidad:** Media
**Pasos:**
1. Clic en "Ver Fotos"
**Resultado Esperado:** Galeria de fotos del dia

---

## 2.3 Reportes y Metricas

### TC-D11: Generar reporte por rango de fechas
**Severidad:** Alta
**Pasos:**
1. Navegar a Reportes
2. Seleccionar rango
3. Generar
**Resultado Esperado:** Tabla con estadisticas por curso

### TC-D12: Exportar reporte a PDF
**Severidad:** Media
**Pasos:**
1. Generar reporte
2. Exportar PDF
**Resultado Esperado:** Descarga PDF con tabla y graficos

### TC-D13: Vista de metricas avanzadas
**Severidad:** Media
**Pasos:**
1. Navegar a Metricas
**Resultado Esperado:**
- Tasa de asistencia general
- Top 10 atrasos
- Alumnos en riesgo

---

## 2.4 Gestion de Alumnos

### TC-D14: Listar alumnos
**Severidad:** Critica
**Pasos:**
1. Navegar a Alumnos
**Resultado Esperado:** Lista de 60 estudiantes

### TC-D15: Crear nuevo alumno
**Severidad:** Alta
**Pasos:**
1. Clic en "+ Nuevo Alumno"
2. Completar formulario
3. Guardar
**Resultado Esperado:** Alumno creado y visible

### TC-D16: Editar alumno
**Severidad:** Alta
**Pasos:**
1. Clic en Editar
2. Modificar datos
3. Guardar
**Resultado Esperado:** Cambios persistidos

### TC-D17: Ver perfil de alumno
**Severidad:** Media
**Pasos:**
1. Clic en Ver perfil
**Resultado Esperado:** Modal con estadisticas

### TC-D18: Registrar asistencia manual
**Severidad:** Alta
**Pasos:**
1. En perfil, registrar entrada/salida
**Resultado Esperado:** Evento creado con source=MANUAL

### TC-D19: Eliminar alumno
**Severidad:** Media
**Pasos:**
1. Clic en Eliminar
2. Confirmar
**Resultado Esperado:** Alumno removido

---

## 2.5 Gestion de Profesores

### TC-D20: Listar profesores
**Severidad:** Alta
**Pasos:**
1. Navegar a Profesores
**Resultado Esperado:** Lista de 3 profesores

### TC-D21: Crear profesor
**Severidad:** Alta
**Pasos:**
1. Nuevo profesor
2. Completar datos
3. Guardar
**Resultado Esperado:** Profesor creado

### TC-D22: Asignar cursos a profesor
**Severidad:** Alta
**Pasos:**
1. Editar profesor
2. Asignar cursos
3. Guardar
**Resultado Esperado:** Cursos visibles en lista

### TC-D23: Inspector no puede acceder a profesores
**Severidad:** Alta
**Precondiciones:** Usuario Inspector
**Pasos:**
1. Intentar navegar a Profesores
**Resultado Esperado:** Acceso denegado o menu oculto

---

## 2.6 Dispositivos

### TC-D24: Listar dispositivos
**Severidad:** Media
**Pasos:**
1. Navegar a Dispositivos
**Resultado Esperado:** Lista con estado de cada kiosk

### TC-D25: Ping a dispositivo
**Severidad:** Baja
**Pasos:**
1. Clic en Ping
**Resultado Esperado:** Respuesta o timeout

### TC-D26: Ver logs de dispositivo
**Severidad:** Baja
**Pasos:**
1. Clic en Ver logs
**Resultado Esperado:** Modal con logs recientes

---

## 2.7 Notificaciones

### TC-D27: Ver bitacora de notificaciones
**Severidad:** Media
**Pasos:**
1. Navegar a Notificaciones
**Resultado Esperado:** Lista con estadisticas

### TC-D28: Filtrar por canal y estado
**Severidad:** Media
**Pasos:**
1. Filtrar por WhatsApp/Fallidas
**Resultado Esperado:** Resultados filtrados

### TC-D29: Reintentar notificacion fallida
**Severidad:** Baja
**Pasos:**
1. Clic en Reintentar
**Resultado Esperado:** Estado cambia a Pendiente

---

## 2.8 Horarios y Excepciones

### TC-D30: Ver horarios por curso
**Severidad:** Alta
**Pasos:**
1. Navegar a Horarios
**Resultado Esperado:** Tabla L-V con horarios

### TC-D31: Editar horario
**Severidad:** Media
**Pasos:**
1. Modificar hora
2. Guardar
**Resultado Esperado:** Cambio persistido

### TC-D32: Crear excepcion de calendario
**Severidad:** Media
**Pasos:**
1. Navegar a Excepciones
2. Nueva excepcion
3. Guardar
**Resultado Esperado:** Excepcion creada

---

## 2.9 Ausencias

### TC-D33: Ver solicitudes pendientes
**Severidad:** Alta
**Pasos:**
1. Navegar a Ausencias
**Resultado Esperado:** Lista de solicitudes

### TC-D34: Aprobar solicitud
**Severidad:** Alta
**Pasos:**
1. Clic en Aprobar
**Resultado Esperado:** Estado cambia a Aprobada

### TC-D35: Rechazar solicitud
**Severidad:** Alta
**Pasos:**
1. Clic en Rechazar
**Resultado Esperado:** Estado cambia a Rechazada

---

# FASE 3: APODERADO (18 casos)

## 3.1 Autenticacion

### TC-P01: Login con credenciales
**Severidad:** Critica
**Pasos:**
1. Seleccionar Apoderado
2. Ingresar credenciales
**Resultado Esperado:** Acceso a home con hijos

### TC-P02: Login modo demo
**Severidad:** Alta
**Pasos:**
1. Seleccionar apoderado demo
**Resultado Esperado:** Acceso con 2 hijos vinculados

### TC-P03: Solo ve sus hijos
**Severidad:** Critica
**Pasos:**
1. Verificar lista de estudiantes
**Resultado Esperado:** Solo hijos vinculados al guardian

---

## 3.2 Vista Principal

### TC-P04: Estado actual de cada hijo
**Severidad:** Critica
**Pasos:**
1. Verificar cards en home
**Resultado Esperado:** Nombre, curso, estado de ingreso/salida

### TC-P05: Indicadores visuales correctos
**Severidad:** Alta
**Verificar:**
- Ingreso on-time: Check verde
- Ingreso con atraso: Warning amarillo
- Sin ingreso: Signo de interrogacion
- Salida: Icono casa

---

## 3.3 Historial

### TC-P06: Ver historial de un hijo
**Severidad:** Alta
**Pasos:**
1. Clic en Ver Historial
**Resultado Esperado:** Lista de eventos del estudiante

### TC-P07: Filtrar por rango de fechas
**Severidad:** Media
**Pasos:**
1. Seleccionar fechas
2. Buscar
**Resultado Esperado:** Eventos filtrados

### TC-P08: Cambiar entre hijos
**Severidad:** Alta
**Pasos:**
1. Seleccionar otro hijo en dropdown
**Resultado Esperado:** Historial del hijo seleccionado

### TC-P09: No puede ver datos de otros estudiantes
**Severidad:** Critica
**Pasos:**
1. Modificar URL con otro student_id
**Resultado Esperado:** Error o datos vacios

---

## 3.4 Preferencias

### TC-P10: Ver preferencias actuales
**Severidad:** Alta
**Pasos:**
1. Navegar a Preferencias
**Resultado Esperado:** Checkboxes con valores actuales

### TC-P11: Modificar canales de notificacion
**Severidad:** Alta
**Pasos:**
1. Cambiar checkboxes
2. Guardar
**Resultado Esperado:** Preferencias persistidas

### TC-P12: Configurar tipo de evidencia por hijo
**Severidad:** Alta
**Pasos:**
1. Seleccionar Foto/Audio/Sin evidencia
2. Guardar
**Resultado Esperado:** Preferencia guardada por hijo

### TC-P13: Ver contactos registrados
**Severidad:** Media
**Pasos:**
1. Verificar seccion de contactos
**Resultado Esperado:** Telefono y email verificados

---

## 3.5 Ausencias

### TC-P14: Crear solicitud de ausencia
**Severidad:** Alta
**Pasos:**
1. Navegar a Ausencias
2. Seleccionar hijo, tipo, fechas
3. Enviar
**Resultado Esperado:** Solicitud creada en Pendientes

### TC-P15: Ver estado de solicitudes
**Severidad:** Media
**Pasos:**
1. Verificar tabs
**Resultado Esperado:** Solicitudes categorizadas

### TC-P16: Adjuntar certificado medico
**Severidad:** Baja
**Pasos:**
1. Subir archivo
2. Enviar solicitud
**Resultado Esperado:** Archivo adjunto visible

---

## 3.6 Navegacion Movil

### TC-P17: Navegacion por bottom bar
**Severidad:** Media
**Pasos:**
1. Usar menu inferior
**Resultado Esperado:** Navegacion funcional

### TC-P18: Vista responsive en movil
**Severidad:** Media
**Pasos:**
1. Redimensionar a 375px
**Resultado Esperado:** Layout adaptado

---

# FASE 4: PROFESOR (22 casos)

## 4.1 Autenticacion

### TC-T01: Login con credenciales
**Severidad:** Critica
**Pasos:**
1. Ingresar email/password
**Resultado Esperado:** Acceso a lista de cursos

### TC-T02: Login modo demo
**Severidad:** Alta
**Pasos:**
1. Seleccionar profesor demo
**Resultado Esperado:** Acceso con cursos asignados

### TC-T03: Solo ve cursos asignados
**Severidad:** Critica
**Pasos:**
1. Verificar lista de cursos
**Resultado Esperado:** Solo cursos asignados al profesor

---

## 4.2 Cursos y Nomina

### TC-T04: Ver cursos asignados
**Severidad:** Alta
**Pasos:**
1. Verificar cards de cursos
**Resultado Esperado:** 1 curso para profesora Maria

### TC-T05: Seleccionar curso
**Severidad:** Alta
**Pasos:**
1. Clic en card de curso
**Resultado Esperado:** Redireccion a nomina

### TC-T06: Ver nomina de estudiantes
**Severidad:** Critica
**Pasos:**
1. Verificar lista
**Resultado Esperado:** 20 estudiantes con estado

### TC-T07: Ver estado de asistencia de cada estudiante
**Severidad:** Alta
**Pasos:**
1. Verificar columna Estado
**Resultado Esperado:** Hora de ingreso o "Sin registro"

---

## 4.3 Registro Individual

### TC-T08: Registrar entrada individual
**Severidad:** Critica
**Pasos:**
1. Clic en boton IN verde
**Resultado Esperado:** Evento IN creado, estado actualizado

### TC-T09: Registrar salida individual
**Severidad:** Critica
**Pasos:**
1. Clic en boton OUT
**Resultado Esperado:** Evento OUT creado

### TC-T10: Ver perfil de estudiante
**Severidad:** Media
**Pasos:**
1. Clic en icono de perfil
**Resultado Esperado:** Estadisticas del estudiante

---

## 4.4 Escaneo QR

### TC-T11: Escanear QR de estudiante
**Severidad:** Alta
**Pasos:**
1. Ir a Escanear QR
2. Ingresar token valido
**Resultado Esperado:** Estudiante identificado, evento registrado

### TC-T12: Token de estudiante de otro curso
**Severidad:** Alta
**Pasos:**
1. Escanear token de otro curso
**Resultado Esperado:** Error o advertencia

---

## 4.5 Marcado en Lote

### TC-T13: Abrir vista de marcado en lote
**Severidad:** Alta
**Pasos:**
1. Clic en "Tomar Asistencia Rapida"
**Resultado Esperado:** Vista con todos los estudiantes

### TC-T14: Marcar multiples como presente
**Severidad:** Critica
**Pasos:**
1. Cambiar estado de varios
2. Enviar
**Resultado Esperado:** Eventos IN creados

### TC-T15: Marcar como ausente
**Severidad:** Alta
**Pasos:**
1. Marcar ausente
2. Enviar
**Resultado Esperado:** Sin evento creado (correcto)

### TC-T16: Evitar duplicados
**Severidad:** Alta
**Precondiciones:** Estudiantes con entrada registrada
**Pasos:**
1. Marcar en lote
**Resultado Esperado:** Solo nuevos eventos creados

---

## 4.6 Alertas

### TC-T17: Ver alumnos sin registro
**Severidad:** Alta
**Pasos:**
1. Navegar a Alertas
**Resultado Esperado:** Lista de sin ingreso

### TC-T18: Marcar presente desde alertas
**Severidad:** Alta
**Pasos:**
1. Clic en Presente
**Resultado Esperado:** Alumno movido a presentes

### TC-T19: Marcar todos como presentes
**Severidad:** Media
**Pasos:**
1. Clic en Marcar Todos
**Resultado Esperado:** Todos registrados

---

## 4.7 Historial y Cola

### TC-T20: Ver historial con filtros
**Severidad:** Media
**Pasos:**
1. Navegar a Historial
2. Aplicar filtros
**Resultado Esperado:** Eventos filtrados

### TC-T21: Sincronizar cola manualmente
**Severidad:** Media
**Pasos:**
1. Navegar a Cola
2. Sincronizar
**Resultado Esperado:** Eventos sincronizados

### TC-T22: Modo offline
**Severidad:** Alta
**Pasos:**
1. Simular offline
2. Registrar eventos
3. Verificar cola
**Resultado Esperado:** Eventos pendientes localmente

---

# FASE 5: SUPER ADMIN (15 casos)

## 5.1 Autenticacion

### TC-SA01: Login Super Admin
**Severidad:** Critica
**Pasos:**
1. Navegar a #/super-admin/auth
2. Ingresar admin@gocode.cl / Demo123!
**Resultado Esperado:** Acceso a dashboard

### TC-SA02: Token tipo super_admin requerido
**Severidad:** Critica
**Pasos:**
1. Intentar usar token de usuario normal
**Resultado Esperado:** Error de permisos

---

## 5.2 Dashboard

### TC-SA03: Ver metricas de plataforma
**Severidad:** Alta
**Pasos:**
1. Verificar cards en dashboard
**Resultado Esperado:** Total tenants, activos, alumnos, eventos

### TC-SA04: Ver tenants recientes
**Severidad:** Media
**Pasos:**
1. Verificar lista
**Resultado Esperado:** Tenant demo visible

---

## 5.3 Gestion de Tenants

### TC-SA05: Listar todos los tenants
**Severidad:** Alta
**Pasos:**
1. Navegar a Tenants
**Resultado Esperado:** Tabla con columnas completas

### TC-SA06: Buscar tenant por nombre
**Severidad:** Media
**Pasos:**
1. Escribir en buscador
**Resultado Esperado:** Resultados filtrados

### TC-SA07: Filtrar por estado
**Severidad:** Media
**Pasos:**
1. Clic en Activos/Inactivos
**Resultado Esperado:** Lista filtrada

### TC-SA08: Ver detalle de tenant
**Severidad:** Alta
**Pasos:**
1. Clic en nombre de tenant
**Resultado Esperado:** Vista de detalle

### TC-SA09: Crear nuevo tenant
**Severidad:** Alta
**Pasos:**
1. Clic en + Nuevo Tenant
2. Completar formulario
3. Guardar
**Resultado Esperado:** Tenant creado

### TC-SA10: Desactivar tenant
**Severidad:** Alta
**Pasos:**
1. Clic en Desactivar
**Resultado Esperado:** Estado cambia a Inactivo

### TC-SA11: Reactivar tenant
**Severidad:** Media
**Pasos:**
1. Clic en Activar
**Resultado Esperado:** Estado cambia a Activo

---

## 5.4 Configuracion de Tenant

### TC-SA12: Editar configuracion
**Severidad:** Media
**Pasos:**
1. En detalle, editar config
2. Guardar
**Resultado Esperado:** Cambios persistidos

### TC-SA13: Modificar feature flags
**Severidad:** Media
**Pasos:**
1. Toggle features
2. Guardar
**Resultado Esperado:** Features actualizadas

---

## 5.5 Impersonacion

### TC-SA14: Impersonar tenant
**Severidad:** Alta
**Pasos:**
1. Clic en Impersonar
**Resultado Esperado:** Vista como director del tenant

### TC-SA15: Salir de impersonacion
**Severidad:** Alta
**Pasos:**
1. Clic en Salir
**Resultado Esperado:** Vuelve a Super Admin

---

# FASE 6: MULTI-TENANT (10 casos)

## 6.1 Aislamiento de Datos

### TC-MT01: Usuario no ve datos de otro tenant
**Severidad:** Critica
**Pasos:**
1. Login como director de Tenant A
2. Verificar datos mostrados
**Resultado Esperado:** Solo datos de Tenant A

### TC-MT02: API rechaza token de otro tenant
**Severidad:** Critica
**Pasos:**
1. Obtener token de Tenant A
2. Hacer request a dominio de Tenant B
**Resultado Esperado:** Error 403

### TC-MT03: Bootstrap retorna solo datos del tenant
**Severidad:** Critica
**Pasos:**
1. Verificar /api/v1/web-app/bootstrap
**Resultado Esperado:** current_user.tenant_id correcto

### TC-MT04: Kiosk no puede acceder a otros schemas
**Severidad:** Critica
**Pasos:**
1. Configurar kiosk con Device Key
2. Verificar datos sincronizados
**Resultado Esperado:** Solo estudiantes del tenant

---

## 6.2 Tenant Context

### TC-MT05: Web routes usan tenant schema
**Severidad:** Critica
**Pasos:**
1. Login como director
2. Verificar dashboard
**Resultado Esperado:** Datos del tenant correcto (fix BUG-016)

### TC-MT06: Teacher PWA respeta tenant
**Severidad:** Alta
**Pasos:**
1. Login como profesor
2. Verificar cursos/estudiantes
**Resultado Esperado:** Solo datos del tenant

### TC-MT07: Parent web respeta tenant
**Severidad:** Alta
**Pasos:**
1. Login como apoderado
2. Verificar hijos
**Resultado Esperado:** Solo hijos vinculados en tenant

---

## 6.3 Session Isolation

### TC-MT08: Sesiones no se mezclan entre tenants
**Severidad:** Critica
**Pasos:**
1. Abrir tabs de dos tenants
2. Verificar cookies/tokens
**Resultado Esperado:** Sesiones independientes

### TC-MT09: Logout no afecta otro tenant
**Severidad:** Alta
**Pasos:**
1. Logout en Tenant A
2. Verificar sesion en Tenant B
**Resultado Esperado:** Sesion B activa

### TC-MT10: Super Admin puede impersonar sin afectar datos
**Severidad:** Alta
**Pasos:**
1. Impersonar tenant
2. Verificar modo read-only
**Resultado Esperado:** No modifica datos

---

# FASE 7: SEGURIDAD (12 casos)

## 7.1 Autenticacion

### TC-SEC01: Brute force protection
**Severidad:** Alta
**Pasos:**
1. 5 intentos fallidos
**Resultado Esperado:** Rate limiting o bloqueo temporal

### TC-SEC02: Token expiration
**Severidad:** Alta
**Pasos:**
1. Usar token expirado
**Resultado Esperado:** Error 401

### TC-SEC03: Refresh token funcional
**Severidad:** Alta
**Pasos:**
1. Dejar expirar access token
2. Verificar auto-refresh
**Resultado Esperado:** Nueva sesion sin re-login

---

## 7.2 Autorizacion

### TC-SEC04: RBAC - Director vs Inspector
**Severidad:** Alta
**Pasos:**
1. Inspector intenta acceder a Profesores
**Resultado Esperado:** Acceso denegado

### TC-SEC05: Parent solo accede a sus hijos
**Severidad:** Critica
**Pasos:**
1. Manipular student_id en URL
**Resultado Esperado:** Error o datos vacios

### TC-SEC06: Teacher solo accede a sus cursos
**Severidad:** Critica
**Pasos:**
1. Manipular course_id en URL
**Resultado Esperado:** Error o acceso denegado

---

## 7.3 Input Validation

### TC-SEC07: XSS prevention
**Severidad:** Critica
**Pasos:**
1. Ingresar <script> en campo de texto
**Resultado Esperado:** Script no se ejecuta

### TC-SEC08: SQL injection prevention
**Severidad:** Critica
**Pasos:**
1. Ingresar payload SQL en busqueda
**Resultado Esperado:** Query seguro

### TC-SEC09: CSRF token validation
**Severidad:** Alta
**Pasos:**
1. Intentar POST sin token CSRF
**Resultado Esperado:** Error 403

---

## 7.4 Data Protection

### TC-SEC10: Passwords no visibles en responses
**Severidad:** Alta
**Pasos:**
1. Verificar responses de API
**Resultado Esperado:** password_hash nunca incluido

### TC-SEC11: Sensitive data encryption
**Severidad:** Media
**Pasos:**
1. Verificar storage de tokens
**Resultado Esperado:** Tokens en sessionStorage, no localStorage

### TC-SEC12: Device key timing-safe comparison
**Severidad:** Media
**Pasos:**
1. Verificar implementacion
**Resultado Esperado:** secrets.compare_digest usado

---

# FASE 8: PERFORMANCE (8 casos)

## 8.1 Tiempos de Carga

### TC-PERF01: Carga inicial < 3s
**Severidad:** Alta
**Pasos:**
1. Medir tiempo de carga de cada app
**Criterio:** < 3 segundos

### TC-PERF02: Navegacion < 1s
**Severidad:** Alta
**Pasos:**
1. Medir tiempo de navegacion entre vistas
**Criterio:** < 1 segundo

### TC-PERF03: API response < 500ms
**Severidad:** Alta
**Pasos:**
1. Medir tiempos de API
**Criterio:** < 500ms promedio

---

## 8.2 Optimizacion

### TC-PERF04: Lazy loading de imagenes
**Severidad:** Media
**Pasos:**
1. Verificar carga de fotos
**Resultado Esperado:** Imagenes cargadas on-demand

### TC-PERF05: Caching de datos
**Severidad:** Media
**Pasos:**
1. Verificar localStorage/IndexedDB
**Resultado Esperado:** Datos cacheados apropiadamente

### TC-PERF06: Minificacion de assets
**Severidad:** Baja
**Pasos:**
1. Verificar tamano de JS/CSS
**Resultado Esperado:** Assets minificados en produccion

---

## 8.3 Escalabilidad

### TC-PERF07: Lista de 60 estudiantes sin lag
**Severidad:** Alta
**Pasos:**
1. Cargar nomina completa
**Resultado Esperado:** Render fluido

### TC-PERF08: Exportacion de 1000 eventos
**Severidad:** Media
**Pasos:**
1. Exportar CSV grande
**Resultado Esperado:** Descarga sin timeout

---

# Anexo: Checklist de Regresion

## Bugs Anteriores a Verificar

| Bug ID | Descripcion | Verificacion |
|--------|-------------|--------------|
| BUG-001 | /app sin trailing slash | Navegar a /app |
| BUG-003 | const Views duplicado | Verificar consola sin errores |
| BUG-004 | Kiosk bootstrap vacio | Verificar 60 estudiantes |
| BUG-005 | Attendance student not found | Registrar evento |
| BUG-009 | AuthService schema publico | Login funcional |
| BUG-012 | IDB.get faltante | Vista Alertas en Teacher |
| BUG-014 | Mixed content super admin | Dashboard super admin |
| BUG-015 | tenants.filter error | Lista de tenants |
| BUG-016 | Web routes schema publico | Dashboard director |

---

# Ejecucion de Pruebas

## Prioridad de Ejecucion

1. **Criticos (Bloqueantes):** TC-K04, TC-D01, TC-P01, TC-T01, TC-SA01, TC-MT01
2. **Altos (Funcionalidad core):** TC-K02, TC-D05, TC-P04, TC-T08, TC-MT05
3. **Medios (Funcionalidad secundaria):** TC-K15, TC-D11, TC-P10, TC-T17
4. **Bajos (Nice to have):** TC-K14, TC-D26, TC-P16

## Ambiente de Pruebas

- **Browser:** Chrome 120+, Firefox 120+, Safari 17+
- **Dispositivos:** Desktop 1920x1080, Tablet 768x1024, Mobile 375x667
- **Network:** Simular 3G para pruebas offline
