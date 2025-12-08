# Plan de Pruebas de UI - Sistema de Asistencia Escolar

**URLs de Prueba:**
- Landing/Kiosk: https://school-attendance.dev.gocode.cl
- Web App (Login/Demo): https://school-attendance.dev.gocode.cl/app

---

## Resumen de Fases por Rol

| Fase | Rol | Aplicacion | Casos |
|------|-----|------------|-------|
| 1 | Kiosk (Dispositivo) | kiosk-app | 15 casos |
| 2 | Director/Inspector | web-app | 25 casos |
| 3 | Apoderado (Parent) | web-app | 12 casos |
| 4 | Profesor | teacher-pwa | 18 casos |
| 5 | Super Admin | web-app | 8 casos |

---

# FASE 1: KIOSK (Dispositivo de Registro)

**URL:** https://school-attendance.dev.gocode.cl
**Acceso:** Sin autenticacion (dispositivo publico)

## 1.1 Configuracion Inicial

### TC-K01: Primera configuracion del kiosk
**Precondiciones:** Kiosk sin configurar (localStorage vacio)
**Pasos:**
1. Abrir URL del kiosk
2. Verificar redireccion automatica a `/settings`
3. Ingresar Gate ID: `GATE-TEST-01`
4. Ingresar Device ID: `DEV-001` (o clic en "Generar")
5. Seleccionar idioma: Espanol
6. Activar checkbox "Photo Capture"
7. Clic en "Guardar"
**Resultado Esperado:**
- Redireccion a `/home`
- Header muestra Gate ID configurado
- Badge de estado Online visible

### TC-K02: Cargar datos de prueba
**Precondiciones:** Kiosk configurado
**Pasos:**
1. Navegar a `/settings` (via panel admin)
2. Clic en "Cargar Datos de Ejemplo"
3. Verificar toast de confirmacion
**Resultado Esperado:**
- Datos de estudiantes, profesores y tags cargados
- Estado refleja datos disponibles

---

## 1.2 Escaneo QR/NFC

### TC-K03: Registro de entrada con QR valido (estudiante)
**Precondiciones:** Datos de prueba cargados
**Pasos:**
1. En `/home`, ingresar token manual: `qr_011`
2. Clic en "Generar Token Valido" si hay input manual disponible
3. Simular lectura del token
**Resultado Esperado:**
- Sonido de beep + vibracion
- Pantalla de bienvenida con nombre del estudiante
- Icono de entrada (mano saludando)
- Fecha y hora en vivo
- Redireccion automatica a escaneo en 5 segundos

### TC-K04: Registro de salida con QR valido
**Precondiciones:** Estudiante ya tiene registro de entrada hoy
**Pasos:**
1. Escanear mismo token del TC-K03
**Resultado Esperado:**
- Pantalla de despedida con icono de mochila
- Mensaje "Hasta manana, [Nombre]"
- Tipo de evento: OUT

### TC-K05: Token QR invalido
**Pasos:**
1. Ingresar token inexistente: `qr_invalid_999`
2. Simular lectura
**Resultado Esperado:**
- Toast de error: "Token no valido"
- Escaneo continua activo
- No se registra evento

### TC-K06: Token revocado
**Pasos:**
1. Ingresar token revocado: `nfc_revoked_001` (si existe en datos de prueba)
**Resultado Esperado:**
- Toast de error: "Credencial revocada"
- No se registra evento

### TC-K07: Escaneo de credencial de profesor
**Pasos:**
1. Ingresar token de profesor: `nfc_teacher_001`
**Resultado Esperado:**
- Feedback de bienvenida breve
- Redireccion a `/admin-panel`
- Camara y NFC se detienen

---

## 1.3 Captura de Evidencia

### TC-K08: Captura de foto en registro
**Precondiciones:** Photo Capture habilitado en settings
**Pasos:**
1. Escanear token de estudiante con consentimiento de foto
2. En pantalla de confirmacion, verificar activacion de camara
3. Clic en "Confirmar Ingreso"
**Resultado Esperado:**
- Camara frontal se activa automaticamente
- Sonido de obturador al confirmar
- Foto se adjunta al evento
- Overlay de confirmacion muestra foto capturada

### TC-K09: Grabacion de audio como evidencia
**Precondiciones:** Audio habilitado, preferencia de estudiante = audio
**Pasos:**
1. Escanear token de estudiante con preferencia de audio
2. Clic en boton "Grabar"
3. Hablar por 3 segundos
4. Clic en "Detener"
5. Verificar preview de audio
6. Clic en "Confirmar"
**Resultado Esperado:**
- Timer en vivo durante grabacion
- Preview de audio reproducible
- Audio se adjunta al evento

### TC-K10: Sin evidencia por falta de consentimiento
**Precondiciones:** Estudiante sin consentimiento de foto
**Pasos:**
1. Escanear token de estudiante sin consentimiento
**Resultado Esperado:**
- Camara NO se activa
- Confirmacion procede sin evidencia
- Evento se registra correctamente

---

## 1.4 Autenticacion Biometrica

### TC-K11: Autenticacion por huella digital
**Precondiciones:** Estudiante con huella registrada, dispositivo con WebAuthn
**Pasos:**
1. En `/home`, clic en "Olvidaste tu tarjeta? Usa tu huella"
2. En `/biometric-auth`, clic en "Iniciar Identificacion"
3. Colocar dedo en sensor (simular con autenticador)
**Resultado Esperado:**
- Animacion de sensor leyendo
- Identificacion exitosa muestra nombre
- Redireccion automatica a `/scan-result`

### TC-K12: Huella no reconocida
**Pasos:**
1. Intentar autenticacion con huella no registrada
**Resultado Esperado:**
- Mensaje de error: "No se pudo identificar"
- Opcion de reintentar
- Reset automatico despues de 3 segundos

### TC-K13: Dispositivo sin soporte biometrico
**Precondiciones:** Navegador sin WebAuthn
**Pasos:**
1. Intentar acceder a `/biometric-auth`
**Resultado Esperado:**
- Mensaje: "Tu dispositivo no soporta autenticacion biometrica"
- Boton "Volver al escaner"

---

## 1.5 Panel de Administracion (Profesor)

### TC-K14: Timeout de sesion de profesor
**Precondiciones:** Profesor autenticado en admin panel
**Pasos:**
1. Escanear credencial de profesor
2. Esperar 4 minutos sin actividad
3. Observar warning de timeout
4. Esperar 1 minuto mas
**Resultado Esperado:**
- A los 4 min: Warning "Sesion expira en 60s"
- A los 5 min: Toast "Sesion expirada" + redireccion a `/home`

### TC-K15: Registro biometrico de estudiante
**Precondiciones:** Profesor con permiso de enrollment
**Pasos:**
1. En admin panel, clic en "Registro Biometrico"
2. Buscar estudiante por nombre
3. Seleccionar estudiante
4. Clic en "Registrar Huella"
5. Seguir instrucciones del sensor
**Resultado Esperado:**
- Estudiante aparece con foto/avatar
- Badge actualiza a "1 huella registrada"
- Doble beep de confirmacion

---

## 1.6 Cola de Sincronizacion

### TC-K16: Visualizacion de cola pendiente
**Pasos:**
1. Navegar a `/queue` desde admin panel
2. Verificar tabs: Pendientes, En Progreso, Sincronizados, Errores
3. Revisar contadores en cada tab
**Resultado Esperado:**
- Tabla muestra eventos con: Alumno, Tipo, Hora, Estado
- Contadores reflejan cantidad correcta

### TC-K17: Sincronizacion manual
**Precondiciones:** Eventos pendientes en cola
**Pasos:**
1. Clic en "Sincronizar Ahora"
**Resultado Esperado:**
- Toast de progreso
- Eventos pasan a "Sincronizados" o "Errores"
- Contadores se actualizan

---

# FASE 2: DIRECTOR/INSPECTOR

**URL:** https://school-attendance.dev.gocode.cl/app
**Acceso:** Login con credenciales o modo demo

## 2.1 Autenticacion

### TC-D01: Login como Director
**Pasos:**
1. Abrir URL de la app
2. Clic en "Direccion / Inspectoria"
3. Ingresar email y contrasena validos
4. Clic en "Iniciar Sesion"
**Resultado Esperado:**
- Redireccion a dashboard
- Sidebar muestra menu de director
- Nombre del usuario en header

### TC-D02: Acceso en modo demo
**Pasos:**
1. En pantalla de login, clic en boton "Demo Director"
**Resultado Esperado:**
- Acceso inmediato al dashboard
- Badge "Modo Demo" visible
- Datos de prueba cargados

### TC-D03: Login fallido
**Pasos:**
1. Ingresar credenciales invalidas
**Resultado Esperado:**
- Mensaje de error visible
- Formulario mantiene email ingresado
- No hay redireccion

---

## 2.2 Dashboard en Vivo

### TC-D04: Visualizacion de estadisticas del dia
**Precondiciones:** Director autenticado
**Pasos:**
1. Navegar a Dashboard
2. Verificar tarjetas de resumen
**Resultado Esperado:**
- Tarjetas: Ingresos, Salidas, Atrasos, Sin Ingreso
- Numeros actualizados segun datos

### TC-D05: Filtrado de eventos
**Pasos:**
1. Seleccionar curso especifico
2. Seleccionar tipo: "Entrada"
3. Clic en "Aplicar Filtros"
**Resultado Esperado:**
- Tabla muestra solo eventos del curso seleccionado
- Solo eventos tipo IN visibles

### TC-D06: Exportacion CSV de eventos
**Pasos:**
1. Configurar filtros deseados
2. Clic en "Exportar CSV"
**Resultado Esperado:**
- Descarga archivo .csv
- Archivo contiene columnas: Alumno, Curso, Tipo, Hora, Puerta

### TC-D07: Visualizacion de fotos de evidencia
**Pasos:**
1. Identificar evento con icono de camara
2. Clic en "Ver Fotos"
**Resultado Esperado:**
- Modal con galeria de fotos
- Foto del estudiante visible
- Opcion de cerrar modal

---

## 2.3 Reportes y Metricas

### TC-D08: Generar reporte de asistencia
**Pasos:**
1. Navegar a "Reportes"
2. Seleccionar fecha inicio: hace 7 dias
3. Seleccionar fecha fin: hoy
4. Clic en "Generar"
**Resultado Esperado:**
- Tabla: Curso, Total, Presentes, Atrasos, Ausentes, %
- Grafico de barras por curso
- Grafico de tendencia semanal

### TC-D09: Exportar reporte a PDF
**Pasos:**
1. Generar reporte (TC-D08)
2. Clic en "Exportar PDF"
**Resultado Esperado:**
- Descarga archivo PDF
- PDF contiene tabla y graficos

### TC-D10: Visualizar metricas avanzadas
**Pasos:**
1. Navegar a "Metricas"
**Resultado Esperado:**
- Tasa de asistencia general (%)
- Top 10 alumnos con mas atrasos
- Grafico de distribucion de atrasos por hora
- Lista de alumnos en riesgo

---

## 2.4 Gestion de Alumnos

### TC-D11: Crear nuevo alumno
**Pasos:**
1. Navegar a "Alumnos"
2. Clic en "+ Nuevo Alumno"
3. Completar: Nombre, Curso, RUT
4. Activar "Autorizar foto"
5. Clic en "Guardar"
**Resultado Esperado:**
- Modal se cierra
- Toast de exito
- Alumno aparece en lista

### TC-D12: Editar alumno existente
**Pasos:**
1. Buscar alumno por nombre
2. Clic en icono "Editar"
3. Modificar nombre
4. Guardar
**Resultado Esperado:**
- Cambios reflejados en lista
- Toast de confirmacion

### TC-D13: Ver perfil de alumno
**Pasos:**
1. Clic en icono "Ver perfil" de un alumno
**Resultado Esperado:**
- Modal con info: Nombre, Curso, RUT
- Estadisticas de asistencia
- Lista de apoderados vinculados

### TC-D14: Registrar asistencia manual
**Pasos:**
1. En perfil de alumno, clic en "Ver asistencia"
2. Clic en "Registrar Entrada" o "Registrar Salida"
**Resultado Esperado:**
- Evento creado con source=MANUAL
- Lista de eventos se actualiza

### TC-D15: Eliminar alumno
**Pasos:**
1. Clic en icono "Eliminar" de un alumno
2. Confirmar en dialogo de advertencia
**Resultado Esperado:**
- Alumno removido de lista
- Advertencia sobre registros asociados

---

## 2.5 Gestion de Profesores (Solo Director)

### TC-D16: Crear nuevo profesor
**Pasos:**
1. Navegar a "Profesores"
2. Clic en "+ Nuevo Profesor"
3. Completar: Nombre, Email, Telefono, Especialidad
4. Guardar
**Resultado Esperado:**
- Profesor aparece en lista
- Estado: Activo

### TC-D17: Asignar cursos a profesor
**Pasos:**
1. Clic en "Asignar cursos" de un profesor
2. Marcar checkboxes de cursos
3. Guardar
**Resultado Esperado:**
- Columna "Cursos" muestra cursos asignados

### TC-D18: Inspector no puede acceder a profesores
**Precondiciones:** Usuario con rol Inspector
**Pasos:**
1. Intentar navegar a "Profesores"
**Resultado Esperado:**
- Redireccion a dashboard o mensaje de acceso denegado

---

## 2.6 Dispositivos y Kiosks

### TC-D19: Listar dispositivos
**Pasos:**
1. Navegar a "Dispositivos"
**Resultado Esperado:**
- Lista: Gate ID, Device ID, Version, Ultima sync, Bateria, Estado
- Indicadores de bateria baja (rojo si <30%)

### TC-D20: Ping a dispositivo
**Pasos:**
1. Clic en "Ping" de un dispositivo online
**Resultado Esperado:**
- Toast de respuesta exitosa o timeout

### TC-D21: Ver logs de dispositivo
**Pasos:**
1. Clic en "Ver logs"
**Resultado Esperado:**
- Modal con logs recientes
- Formato: timestamp, nivel, mensaje

---

## 2.7 Notificaciones

### TC-D22: Visualizar bitacora de notificaciones
**Pasos:**
1. Navegar a "Notificaciones"
**Resultado Esperado:**
- Estadisticas: Total, Entregadas, Fallidas, Pendientes
- Tabla con historial

### TC-D23: Filtrar por canal y estado
**Pasos:**
1. Filtrar por Canal: WhatsApp
2. Filtrar por Estado: Fallidas
3. Aplicar filtros
**Resultado Esperado:**
- Solo notificaciones WhatsApp fallidas visibles

### TC-D24: Reintentar notificacion fallida
**Pasos:**
1. Identificar notificacion fallida
2. Clic en "Reintentar"
**Resultado Esperado:**
- Estado cambia a "Pendiente"
- Se encola para reenvio

---

## 2.8 Solicitudes de Ausencia

### TC-D25: Aprobar solicitud de ausencia
**Pasos:**
1. Navegar a "Ausencias"
2. En tab "Pendientes", identificar solicitud
3. Clic en "Aprobar"
**Resultado Esperado:**
- Solicitud se mueve a tab "Aprobadas"
- Notificacion enviada a apoderado

### TC-D26: Rechazar solicitud
**Pasos:**
1. Clic en "Rechazar" de una solicitud
**Resultado Esperado:**
- Solicitud se mueve a tab "Rechazadas"

---

## 2.9 Horarios y Excepciones

### TC-D27: Editar horario base de curso
**Pasos:**
1. Navegar a "Horarios"
2. Modificar hora de ingreso del Lunes para un curso
3. Guardar
**Resultado Esperado:**
- Cambio guardado
- Toast de confirmacion

### TC-D28: Crear excepcion de calendario
**Pasos:**
1. Navegar a "Excepciones"
2. Clic en "+ Nueva Excepcion"
3. Seleccionar fecha, alcance, motivo
4. Guardar
**Resultado Esperado:**
- Excepcion aparece en lista

---

## 2.10 Gestion Biometrica

### TC-D29: Buscar estudiante para enrolar
**Pasos:**
1. Navegar a "Biometria"
2. Buscar por nombre
3. Seleccionar estudiante
**Resultado Esperado:**
- Panel derecho muestra detalles
- Lista de credenciales existentes

### TC-D30: Eliminar credencial biometrica
**Pasos:**
1. Seleccionar estudiante con credencial
2. Clic en "Eliminar" de una credencial
**Resultado Esperado:**
- Credencial removida
- Badge actualiza conteo

---

# FASE 3: APODERADO (Parent)

**URL:** https://school-attendance.dev.gocode.cl/app
**Acceso:** Login como apoderado o modo demo

## 3.1 Autenticacion

### TC-P01: Login como apoderado
**Pasos:**
1. Clic en "Apoderado"
2. Ingresar credenciales
3. Iniciar sesion
**Resultado Esperado:**
- Redireccion a home de apoderado
- Solo ve hijos vinculados

### TC-P02: Acceso demo apoderado
**Pasos:**
1. Clic en boton demo de apoderado
**Resultado Esperado:**
- Acceso con datos de prueba
- Hijos de prueba visibles

---

## 3.2 Vista Principal (Home)

### TC-P03: Visualizar estado de hijos
**Pasos:**
1. En home, revisar tarjetas de cada hijo
**Resultado Esperado:**
- Card por cada hijo con:
  - Nombre, Curso
  - Estado: Ingreso/Salida/Sin registro
  - Hora y puerta si aplica

### TC-P04: Estado visual segun tipo
**Casos a verificar:**
- Ingreso on-time: Check verde
- Ingreso con atraso: Warning amarillo
- Sin ingreso: Signo de interrogacion
- Salida registrada: Icono casa

---

## 3.3 Historial de Asistencia

### TC-P05: Ver historial de un hijo
**Pasos:**
1. Clic en "Ver Historial" de un hijo
2. Verificar tabla de eventos
**Resultado Esperado:**
- Tabla: Fecha, Hora, Tipo, Fuente
- Ultimos 20 registros
- Solo datos del hijo seleccionado

### TC-P06: Filtrar historial por fecha
**Pasos:**
1. Cambiar fecha inicio y fin
2. Clic en "Buscar"
**Resultado Esperado:**
- Tabla actualizada con rango seleccionado

### TC-P07: Seguridad: no puede ver otros hijos
**Pasos:**
1. Intentar modificar URL con ID de otro estudiante
**Resultado Esperado:**
- Error o redireccion
- No muestra datos de otros estudiantes

---

## 3.4 Preferencias de Notificacion

### TC-P08: Configurar canales de notificacion
**Pasos:**
1. Navegar a "Preferencias"
2. Para INGRESO_OK: Activar WhatsApp, desactivar Email
3. Para NO_INGRESO_UMBRAL: Activar ambos
4. Guardar
**Resultado Esperado:**
- Toast de exito
- Cambios persistidos

### TC-P09: Configurar preferencia de evidencia
**Pasos:**
1. En seccion "Tipo de Evidencia"
2. Para hijo 1: Seleccionar "Foto"
3. Para hijo 2: Seleccionar "Sin evidencia"
4. Guardar
**Resultado Esperado:**
- Preferencias guardadas por hijo
- Afecta comportamiento del kiosk

### TC-P10: Fallback a localStorage si API falla
**Precondiciones:** Simular API no disponible
**Pasos:**
1. Intentar guardar preferencias
**Resultado Esperado:**
- Preferencias guardadas localmente
- Warning de modo offline

---

## 3.5 Solicitudes de Ausencia

### TC-P11: Crear solicitud de ausencia
**Pasos:**
1. Navegar a "Ausencias"
2. Seleccionar hijo
3. Tipo: Enfermedad
4. Fecha inicio y fin
5. Comentario: "Resfrio"
6. Adjuntar certificado medico (opcional)
7. Enviar
**Resultado Esperado:**
- Solicitud aparece en tab "Pendientes"
- Toast de confirmacion

### TC-P12: Ver estado de solicitudes
**Pasos:**
1. Revisar tabs: Pendientes, Aprobadas, Rechazadas
**Resultado Esperado:**
- Solicitudes categorizadas correctamente
- Muestra detalles: fechas, tipo, comentario

---

# FASE 4: PROFESOR (Teacher PWA)

**URL:** https://school-attendance.dev.gocode.cl/teacher (o PWA instalada)
**Acceso:** Login o modo demo

## 4.1 Autenticacion

### TC-T01: Login como profesor
**Pasos:**
1. Ingresar email y contrasena
2. Iniciar sesion
**Resultado Esperado:**
- Redireccion a lista de cursos
- Saludo personalizado segun hora del dia

### TC-T02: Acceso demo profesor
**Pasos:**
1. Clic en boton de profesor demo
**Resultado Esperado:**
- Acceso con cursos de prueba asignados

---

## 4.2 Seleccion de Curso

### TC-T03: Ver cursos asignados
**Pasos:**
1. En vista de cursos, verificar tarjetas
**Resultado Esperado:**
- Una tarjeta por curso asignado
- Nombre y nivel de cada curso
- Icono distintivo

### TC-T04: Seleccionar curso
**Pasos:**
1. Clic en tarjeta de un curso
**Resultado Esperado:**
- Redireccion a nomina del curso
- Curso guardado como actual

---

## 4.3 Nomina del Curso

### TC-T05: Ver lista de estudiantes
**Pasos:**
1. En nomina, revisar tabla
**Resultado Esperado:**
- Columnas: Alumno, Estado, Acciones
- Estado muestra hora de ingreso o "Sin registro"

### TC-T06: Registrar entrada individual
**Pasos:**
1. Clic en boton IN (verde) de un estudiante
**Resultado Esperado:**
- Evento IN creado
- Estado actualiza a "Ingreso HH:MM"

### TC-T07: Registrar salida individual
**Pasos:**
1. Clic en boton OUT (gris) de un estudiante
**Resultado Esperado:**
- Evento OUT creado
- Estado actualiza a "Salio HH:MM"

### TC-T08: Ver perfil de estudiante
**Pasos:**
1. Clic en icono de perfil de un estudiante
**Resultado Esperado:**
- Vista de perfil con estadisticas
- Avatar con iniciales
- Porcentaje de asistencia

---

## 4.4 Escaneo QR

### TC-T09: Escanear QR de estudiante
**Pasos:**
1. Clic en "Escanear QR"
2. Ingresar token: `qr_st_001`
3. Clic en "Simular Lectura"
**Resultado Esperado:**
- Estudiante identificado
- Evento registrado (IN o OUT segun historial)
- Auto-navegacion a nomina

### TC-T10: Generar token valido
**Pasos:**
1. Clic en "Generar Valido"
2. Simular lectura
**Resultado Esperado:**
- Token de estudiante aleatorio seleccionado
- Registro exitoso

---

## 4.5 Marcado en Lote

### TC-T11: Marcar asistencia masiva
**Pasos:**
1. En nomina, clic en "Marcado en Lote"
2. Cambiar estados segun corresponda:
   - Estudiante 1: Presente
   - Estudiante 2: Tarde
   - Estudiante 3: Ausente
3. Clic en "Enviar a Cola"
**Resultado Esperado:**
- Eventos IN creados para Presente y Tarde
- Ausente no genera evento
- Toast con cantidad encolada

### TC-T12: Evitar duplicados en lote
**Precondiciones:** Algunos estudiantes ya tienen entrada
**Pasos:**
1. Intentar marcado en lote
**Resultado Esperado:**
- Solo se crean eventos para quienes no tienen entrada
- No hay duplicados

---

## 4.6 Alertas

### TC-T13: Visualizar alumnos sin registro
**Pasos:**
1. Navegar a "Alertas"
**Resultado Esperado:**
- Tarjetas de resumen: Presentes, Sin Registro, Total
- Banner de alerta segun tiempo transcurrido
- Lista de estudiantes sin entrada

### TC-T14: Marcar presente desde alertas
**Pasos:**
1. Clic en "Presente" de un alumno sin registro
**Resultado Esperado:**
- Alumno se mueve a seccion "Presentes"
- Evento IN creado

### TC-T15: Marcar todos como presentes
**Pasos:**
1. Clic en "Marcar Todos"
**Resultado Esperado:**
- Todos los sin registro marcados como presentes
- Toast con cantidad

---

## 4.7 Historial y Cola

### TC-T16: Ver historial con filtros
**Pasos:**
1. Navegar a "Historial"
2. Cambiar fecha y tipo
3. Aplicar filtros
**Resultado Esperado:**
- Eventos filtrados correctamente
- Estadisticas actualizadas

### TC-T17: Sincronizar cola manualmente
**Pasos:**
1. Navegar a "Cola"
2. Clic en "Sincronizar Ahora"
**Resultado Esperado:**
- Eventos pendientes se sincronizan
- Estados actualizan a synced o error

### TC-T18: Modo offline
**Pasos:**
1. En Configuracion, clic en "Simular Offline"
2. Registrar algunos eventos
3. Verificar cola
**Resultado Esperado:**
- Eventos encolados localmente
- Badge de offline visible
- Eventos pendientes al volver online

---

# FASE 5: SUPER ADMIN (Multi-Tenant)

**URL:** https://school-attendance.dev.gocode.cl/app#/super-admin/auth
**Acceso:** Credenciales de Super Admin

## 5.1 Autenticacion Super Admin

### TC-SA01: Login como Super Admin
**Pasos:**
1. Navegar a ruta de super admin
2. Ingresar credenciales de super admin
3. Iniciar sesion
**Resultado Esperado:**
- Acceso a dashboard multi-tenant
- Vista de instituciones

---

## 5.2 Gestion de Tenants

### TC-SA02: Listar instituciones (tenants)
**Pasos:**
1. Navegar a lista de tenants
**Resultado Esperado:**
- Lista de todas las instituciones
- Columnas: Nombre, Plan, Estado, Usuarios, Acciones

### TC-SA03: Ver detalle de tenant
**Pasos:**
1. Clic en nombre de una institucion
**Resultado Esperado:**
- Vista detallada del tenant
- Configuracion y estadisticas

### TC-SA04: Crear nuevo tenant
**Pasos:**
1. Clic en "Nuevo Tenant"
2. Completar formulario de institucion
3. Guardar
**Resultado Esperado:**
- Tenant creado
- Aparece en lista

### TC-SA05: Modificar configuracion de tenant
**Pasos:**
1. En detalle de tenant, editar configuracion
2. Guardar cambios
**Resultado Esperado:**
- Cambios aplicados
- Toast de confirmacion

---

## 5.3 Setup Inicial de Tenant

### TC-SA06: Setup publico de tenant
**URL:** https://school-attendance.dev.gocode.cl/app#/setup
**Pasos:**
1. Navegar a URL de setup
2. Completar formulario de registro
3. Enviar
**Resultado Esperado:**
- Tenant creado con configuracion inicial
- Redireccion a login

### TC-SA07: Validacion de datos en setup
**Pasos:**
1. Intentar enviar formulario incompleto
**Resultado Esperado:**
- Validaciones de campos requeridos
- Mensajes de error claros

### TC-SA08: Feature flags por tenant
**Pasos:**
1. En configuracion de tenant, verificar modulos habilitados
**Resultado Esperado:**
- Lista de modulos con toggles
- Cambios afectan disponibilidad en web-app del tenant

---

# Anexo: Datos de Prueba

## Tokens QR/NFC Validos
- Estudiantes: `qr_001` a `qr_050`, `nfc_001` a `nfc_050`
- Profesores: `nfc_teacher_001`, `nfc_teacher_002`
- Revocados: `nfc_revoked_001`

## Credenciales Demo
- Director: Boton "Demo Director"
- Inspector: Boton "Demo Inspector"
- Apoderado: Boton "Demo Apoderado" + seleccion de apoderado
- Profesor: Botones de profesores demo

## Configuracion de Kiosk de Prueba
- Gate ID: `GATE-TEST-01`
- Device ID: Auto-generado o `DEV-001`

---

# Criterios de Aceptacion Generales

1. **Responsividad:** Todas las vistas deben funcionar en desktop, tablet y movil
2. **Performance:** Carga inicial < 3 segundos, navegacion < 1 segundo
3. **Accesibilidad:** Navegacion por teclado, contraste adecuado
4. **Offline:** Kiosk y Teacher PWA deben funcionar sin conexion
5. **Seguridad:** XSS prevenido, validacion de roles, datos aislados por tenant

---

# Prioridad de Ejecucion

1. **Criticos:** TC-K03, TC-K04, TC-D01, TC-P03, TC-T06
2. **Altos:** TC-K11, TC-D11, TC-P08, TC-T11, TC-SA02
3. **Medios:** TC-K08, TC-D22, TC-P11, TC-T13
4. **Bajos:** TC-K16, TC-D28, TC-T18
