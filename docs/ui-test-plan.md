# Plan de Pruebas de UI - Sistema de Asistencia Escolar

**Version:** 2.0
**Fecha:** 2024-12-15
**Autor:** QA Team

---

## URLs de Prueba

| Ambiente | URL Base |
|----------|----------|
| Local | http://localhost:8083 |
| Dev | https://school-attendance.dev.gocode.cl |
| QA | https://school-attendance.qa.gocode.cl |
| Prod | https://school-attendance.gocode.cl |

| Aplicacion | Path |
|------------|------|
| Login Unificado | / |
| Web App (Admin/Apoderado) | /app |
| Teacher PWA | /teacher |
| Kiosk App | /kiosk |

---

## Resumen de Fases

| Fase | Descripcion | Rol | Casos |
|------|-------------|-----|-------|
| 0 | Login Unificado y Selector | Todos | 15 casos |
| 1 | Kiosk (Dispositivo) | Kiosk | 20 casos |
| 2 | Configuracion Inicial del Tenant | Director | 25 casos |
| 3 | Gestion de Datos Maestros | Director | 35 casos |
| 4 | Operacion Diaria | Director/Inspector | 30 casos |
| 5 | Reportes, Metricas y Graficos | Director | 25 casos |
| 6 | Notificaciones y Comunicaciones | Director | 20 casos |
| 7 | Portal de Apoderados | Apoderado | 18 casos |
| 8 | Teacher PWA | Profesor | 22 casos |
| 9 | Super Admin Multi-Tenant | Super Admin | 15 casos |
| 10 | Escenarios End-to-End | Multiples | 12 casos |

**Total: 217 casos de prueba**

---

## Credenciales de Prueba (Ambiente Local)

| Rol | Email | Contrasena |
|-----|-------|------------|
| Director/Admin | director@demo.example.com | Demo123! |
| Inspector | inspector@demo.example.com | Demo123! |
| Profesor 1 | maria.gonzalez@demo.example.com | Demo123! |
| Profesor 2 | pedro.ramirez@demo.example.com | Demo123! |
| Profesor 3 | carmen.silva@demo.example.com | Demo123! |
| Apoderado 1 | apoderado1@demo.example.com | Demo123! |
| Apoderado 2 | apoderado2@demo.example.com | Demo123! |
| Apoderado 3 | apoderado3@demo.example.com | Demo123! |
| Apoderado 4 | apoderado4@demo.example.com | Demo123! |
| Apoderado 5 | apoderado5@demo.example.com | Demo123! |
| Super Admin | super@gocode.cl | SuperDemo123! |

---

# FASE 0: LOGIN UNIFICADO Y SELECTOR DE APPS

**URL:** /
**Descripcion:** Sistema de login centralizado con selector de aplicaciones basado en rol

## 0.1 Autenticacion Basica

### TC-L01: Login exitoso como Director
**Objetivo:** Verificar login y acceso a selector de apps para rol ADMIN
**Pasos:**
1. Abrir URL raiz
2. Ingresar email: `director@demo.example.com`
3. Ingresar contrasena: `Demo123!`
4. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Formulario de login desaparece
- [ ] Selector de aplicaciones muestra 3 opciones:
  - Panel Administrativo (icono edificio)
  - Portal Profesores (icono profesor)
  - Modo Kiosco (icono tablet)
- [ ] Nombre del usuario visible en header
- [ ] No hay errores en consola del navegador

**Datos de Verificacion:**
```json
{
  "user_role": "ADMIN",
  "apps_visible": ["admin", "teacher", "kiosk"],
  "session_valid": true
}
```

### TC-L02: Login exitoso como Inspector
**Objetivo:** Verificar acceso limitado para rol INSPECTOR
**Pasos:**
1. Abrir URL raiz
2. Ingresar email: `inspector@demo.example.com`
3. Ingresar contrasena: `Demo123!`
4. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Selector muestra solo 2 opciones:
  - Panel Administrativo
  - Modo Kiosco
- [ ] NO aparece Portal Profesores

### TC-L03: Login exitoso como Profesor
**Objetivo:** Verificar acceso para rol TEACHER
**Pasos:**
1. Abrir URL raiz
2. Ingresar email: `maria.gonzalez@demo.example.com`
3. Ingresar contrasena: `Demo123!`
4. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Selector muestra 2 opciones:
  - Portal Profesores
  - Modo Kiosco
- [ ] NO aparece Panel Administrativo

### TC-L04: Login exitoso como Apoderado
**Objetivo:** Verificar redireccion automatica para rol PARENT
**Pasos:**
1. Abrir URL raiz
2. Ingresar email: `apoderado1@demo.example.com`
3. Ingresar contrasena: `Demo123!`
4. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] NO muestra selector (Parent solo tiene acceso a /app)
- [ ] Redireccion automatica a /app
- [ ] Tokens pasados en hash fragment y limpiados inmediatamente
- [ ] Vista de apoderado cargada con hijos vinculados

### TC-L05: Login exitoso como Super Admin
**Objetivo:** Verificar acceso completo para Super Admin
**Pasos:**
1. Abrir URL raiz
2. Ingresar email: `super@gocode.cl`
3. Ingresar contrasena: `SuperDemo123!`
4. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Selector muestra 4 opciones:
  - Panel Super Admin (destacado, icono engranaje)
  - Panel Administrativo
  - Portal Profesores
  - Modo Kiosco

## 0.2 Selector de Aplicaciones

### TC-L06: Navegacion a Panel Administrativo
**Precondiciones:** Login exitoso como Director
**Pasos:**
1. En selector, clic en "Panel Administrativo"

**Resultado Esperado:**
- [ ] Redireccion a /app con tokens en hash fragment
- [ ] URL se limpia automaticamente (tokens removidos)
- [ ] Dashboard carga correctamente
- [ ] Sidebar con menu de director visible

### TC-L07: Boton "Cambiar Aplicacion" en web-app
**Precondiciones:** Sesion activa en web-app como Director
**Pasos:**
1. Clic en boton "Cambiar Aplicacion" en header

**Resultado Esperado:**
- [ ] Redireccion a / con tokens en hash
- [ ] Selector de aplicaciones visible
- [ ] Sesion preservada (no requiere login de nuevo)

### TC-L08: Boton "Cambiar Aplicacion" en teacher-pwa
**Precondiciones:** Sesion activa en teacher-pwa
**Pasos:**
1. Clic en boton "Cambiar Aplicacion"

**Resultado Esperado:**
- [ ] Redireccion a / con tokens en hash
- [ ] Selector visible
- [ ] Sesion preservada

### TC-L09: Navegacion entre apps sin re-login
**Precondiciones:** Login como Director
**Pasos:**
1. Ir a Panel Administrativo
2. Cambiar a Portal Profesores
3. Cambiar a Modo Kiosco
4. Volver a Panel Administrativo

**Resultado Esperado:**
- [ ] Todas las transiciones sin solicitar login
- [ ] Tokens preservados en cada cambio
- [ ] Sesion activa en cada aplicacion

## 0.3 Validaciones y Errores

### TC-L10: Login con credenciales invalidas
**Pasos:**
1. Ingresar email: `usuario@invalido.test`
2. Ingresar contrasena: `contrasena_incorrecta`
3. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Mensaje de error visible: "Credenciales invalidas"
- [ ] Formulario mantiene email ingresado
- [ ] Contrasena limpiada
- [ ] No hay redireccion

### TC-L11: Validacion de campos vacios
**Pasos:**
1. Dejar email vacio
2. Dejar contrasena vacia
3. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Validacion HTML5 impide envio
- [ ] Campos marcados como requeridos

### TC-L12: Validacion de formato de email
**Pasos:**
1. Ingresar email: `email-invalido`
2. Ingresar contrasena: `Demo123!`
3. Clic en "Iniciar Sesion"

**Resultado Esperado:**
- [ ] Validacion de formato de email
- [ ] No se envia peticion al servidor

### TC-L13: Sesion expirada
**Precondiciones:** Token JWT expirado en localStorage
**Pasos:**
1. Navegar a /app directamente

**Resultado Esperado:**
- [ ] Redireccion a login
- [ ] Mensaje de sesion expirada (opcional)

### TC-L14: Refresh token funcional
**Precondiciones:** Access token expirado, refresh token valido
**Pasos:**
1. Realizar accion que requiera autenticacion

**Resultado Esperado:**
- [ ] Token renovado automaticamente
- [ ] Accion completada sin interrupcion

### TC-L15: Logout completo
**Precondiciones:** Sesion activa
**Pasos:**
1. Clic en menu de usuario
2. Clic en "Cerrar Sesion"

**Resultado Esperado:**
- [ ] Tokens eliminados de localStorage
- [ ] Redireccion a login
- [ ] Acceso a /app redirige a login

---

# FASE 1: KIOSK (Dispositivo de Registro)

**URL:** /kiosk
**Acceso:** Sin autenticacion (dispositivo publico)

## 1.1 Configuracion Inicial

### TC-K01: Primera configuracion del kiosk
**Precondiciones:** Kiosk sin configurar (localStorage vacio)
**Pasos:**
1. Abrir /kiosk
2. Verificar redireccion a /settings
3. Ingresar Gate ID: `GATE-ENTRADA-01`
4. Ingresar Device ID: `KIOSK-001` (o generar)
5. Seleccionar idioma: Espanol
6. Activar "Captura de Foto"
7. Clic en "Guardar"

**Resultado Esperado:**
- [ ] Redireccion a /home
- [ ] Header muestra Gate ID configurado
- [ ] Badge de estado Online visible
- [ ] Configuracion persistida en localStorage

**Datos de Verificacion (localStorage):**
```json
{
  "kiosk_gate_id": "GATE-ENTRADA-01",
  "kiosk_device_id": "KIOSK-001",
  "kiosk_language": "es",
  "kiosk_photo_enabled": true
}
```

### TC-K02: Sincronizacion inicial de datos
**Precondiciones:** Kiosk configurado, conexion a servidor
**Pasos:**
1. Verificar sincronizacion automatica al cargar
2. Observar indicador de progreso

**Resultado Esperado:**
- [ ] Datos de estudiantes sincronizados
- [ ] Datos de profesores sincronizados
- [ ] Tags QR/NFC sincronizados
- [ ] Horarios sincronizados
- [ ] Contador de registros en UI

### TC-K03: Cargar datos de ejemplo (desarrollo)
**Precondiciones:** Ambiente de desarrollo
**Pasos:**
1. Navegar a /settings
2. Clic en "Cargar Datos de Ejemplo"

**Resultado Esperado:**
- [ ] Toast de confirmacion
- [ ] Datos cargados en IndexedDB
- [ ] UI refleja datos disponibles

## 1.2 Escaneo QR/NFC

### TC-K04: Registro de entrada con QR valido
**Precondiciones:** Estudiante sin registro de entrada hoy
**Pasos:**
1. En /home, escanear QR de estudiante
2. (Simulacion: ingresar token `qr_st_001`)

**Resultado Esperado:**
- [ ] Sonido de beep + vibracion
- [ ] Pantalla de bienvenida con nombre del estudiante
- [ ] Icono de entrada (check verde)
- [ ] Fecha y hora en vivo
- [ ] Curso del estudiante visible
- [ ] Redireccion automatica a escaneo en 5 segundos

**Registro Creado:**
```json
{
  "student_id": 1,
  "event_type": "IN",
  "source": "QR",
  "gate_id": "GATE-ENTRADA-01",
  "device_id": "KIOSK-001"
}
```

### TC-K05: Registro de salida con QR valido
**Precondiciones:** Estudiante con entrada registrada hoy
**Pasos:**
1. Escanear mismo QR de TC-K04

**Resultado Esperado:**
- [ ] Pantalla de despedida
- [ ] Mensaje "Hasta manana, [Nombre]"
- [ ] Icono de salida (mochila)
- [ ] Tipo de evento: OUT

### TC-K06: Registro con NFC tag
**Precondiciones:** Dispositivo con NFC, tag enrollado
**Pasos:**
1. Activar modo NFC en kiosk
2. Acercar tag NFC de estudiante

**Resultado Esperado:**
- [ ] Lectura automatica del tag
- [ ] Identificacion del estudiante
- [ ] Registro de evento (IN/OUT segun historial)

### TC-K07: Token QR invalido
**Pasos:**
1. Ingresar token inexistente: `qr_invalid_999`

**Resultado Esperado:**
- [ ] Toast de error: "Token no valido"
- [ ] Sonido de error
- [ ] Escaneo continua activo
- [ ] No se registra evento

### TC-K08: Token revocado
**Pasos:**
1. Escanear token con estado REVOKED

**Resultado Esperado:**
- [ ] Toast de error: "Credencial revocada"
- [ ] No se registra evento
- [ ] Log de intento registrado

### TC-K09: Escaneo de credencial de profesor
**Pasos:**
1. Escanear token de profesor

**Resultado Esperado:**
- [ ] Feedback de bienvenida
- [ ] Redireccion a /admin-panel
- [ ] Camara y NFC se detienen
- [ ] Sesion de profesor iniciada

### TC-K10: Registro de entrada tardia
**Precondiciones:** Hora actual > hora de entrada del horario
**Pasos:**
1. Escanear QR de estudiante sin registro

**Resultado Esperado:**
- [ ] Registro marcado como LATE
- [ ] Indicador visual de atraso
- [ ] Notificacion a apoderado incluye "con atraso"

## 1.3 Captura de Evidencia

### TC-K11: Captura de foto en registro
**Precondiciones:** Photo Capture habilitado, estudiante con consentimiento
**Pasos:**
1. Escanear token de estudiante con photo_opt_in=true
2. Verificar activacion de camara
3. Clic en "Confirmar Ingreso"

**Resultado Esperado:**
- [ ] Camara frontal se activa automaticamente
- [ ] Preview de camara visible
- [ ] Sonido de obturador al confirmar
- [ ] Foto adjuntada al evento
- [ ] Overlay de confirmacion muestra foto capturada

### TC-K12: Sin captura por falta de consentimiento
**Precondiciones:** Estudiante con photo_opt_in=false
**Pasos:**
1. Escanear token de estudiante sin consentimiento

**Resultado Esperado:**
- [ ] Camara NO se activa
- [ ] Confirmacion procede sin evidencia
- [ ] Evento registrado correctamente sin foto

### TC-K13: Captura de audio como evidencia
**Precondiciones:** Estudiante con preferencia de audio
**Pasos:**
1. Escanear token
2. Clic en boton "Grabar"
3. Hablar por 3 segundos
4. Clic en "Detener"
5. Verificar preview
6. Clic en "Confirmar"

**Resultado Esperado:**
- [ ] Timer visible durante grabacion
- [ ] Preview de audio reproducible
- [ ] Audio adjuntado al evento

## 1.4 Autenticacion Biometrica

### TC-K14: Autenticacion por huella digital
**Precondiciones:** Estudiante con huella registrada, dispositivo con WebAuthn
**Pasos:**
1. En /home, clic en "Usa tu huella"
2. Clic en "Iniciar Identificacion"
3. Colocar dedo en sensor

**Resultado Esperado:**
- [ ] Animacion de sensor leyendo
- [ ] Identificacion exitosa muestra nombre
- [ ] Redireccion a resultado de registro
- [ ] Evento creado con source=BIOMETRIC

### TC-K15: Huella no reconocida
**Pasos:**
1. Intentar autenticacion con huella no registrada

**Resultado Esperado:**
- [ ] Mensaje: "No se pudo identificar"
- [ ] Opcion de reintentar
- [ ] Sugerencia de usar QR/NFC

### TC-K16: Dispositivo sin soporte biometrico
**Precondiciones:** Navegador sin WebAuthn
**Pasos:**
1. Intentar acceder a autenticacion biometrica

**Resultado Esperado:**
- [ ] Mensaje: "Tu dispositivo no soporta autenticacion biometrica"
- [ ] Boton "Volver al escaner"

## 1.5 Panel de Administracion (Profesor)

### TC-K17: Acceso al admin panel
**Precondiciones:** Profesor autenticado via credencial
**Pasos:**
1. Escanear credencial de profesor

**Resultado Esperado:**
- [ ] Acceso a panel de administracion
- [ ] Opciones: Registro Manual, Configuracion, Cola, Biometria, Cambiar App

### TC-K18: Timeout de sesion de profesor
**Precondiciones:** Profesor en admin panel
**Pasos:**
1. Esperar 4 minutos sin actividad
2. Observar warning
3. Esperar 1 minuto mas

**Resultado Esperado:**
- [ ] A los 4 min: Warning "Sesion expira en 60s"
- [ ] A los 5 min: Toast "Sesion expirada"
- [ ] Redireccion a /home

### TC-K19: Registro biometrico de estudiante
**Precondiciones:** Profesor con permiso de enrollment
**Pasos:**
1. En admin panel, clic en "Registro Biometrico"
2. Buscar estudiante
3. Seleccionar estudiante
4. Clic en "Registrar Huella"
5. Seguir instrucciones

**Resultado Esperado:**
- [ ] Estudiante identificado con foto/avatar
- [ ] Proceso de enrollment WebAuthn iniciado
- [ ] Badge actualiza a "1 huella registrada"
- [ ] Confirmacion de exito

## 1.6 Cola de Sincronizacion

### TC-K20: Modo offline y sincronizacion
**Pasos:**
1. Desconectar red
2. Registrar 3 eventos
3. Verificar cola en /queue
4. Reconectar red
5. Clic en "Sincronizar Ahora"

**Resultado Esperado:**
- [ ] Eventos encolados localmente durante offline
- [ ] Badge de offline visible
- [ ] Tabs: Pendientes(3), Sincronizados(0)
- [ ] Sincronizacion exitosa al reconectar
- [ ] Todos los eventos en tab "Sincronizados"

---

# FASE 2: CONFIGURACION INICIAL DEL TENANT (Director)

**URL:** /app
**Rol:** Director/Admin
**Objetivo:** Configurar el sistema antes de la operacion

## 2.1 Acceso y Dashboard Inicial

### TC-CFG01: Primer acceso como Director
**Precondiciones:** Login exitoso como Director
**Pasos:**
1. En selector, clic en "Panel Administrativo"

**Resultado Esperado:**
- [ ] Dashboard carga correctamente
- [ ] Sidebar visible con menu completo:
  - Dashboard
  - Alumnos
  - Apoderados
  - Cursos
  - Profesores
  - Dispositivos
  - Horarios
  - Excepciones
  - Notificaciones
  - Broadcast
  - Ausencias
  - Reportes
  - Metricas
  - Biometria
- [ ] Header con nombre de usuario y tenant

### TC-CFG02: Verificar dashboard vacio
**Precondiciones:** Sistema sin datos de asistencia del dia
**Pasos:**
1. Navegar a Dashboard

**Resultado Esperado:**
- [ ] Tarjetas de resumen en 0:
  - Ingresos: 0
  - Salidas: 0
  - Atrasos: 0
  - Sin Ingreso: [total estudiantes]
- [ ] Tabla de eventos vacia con mensaje apropiado
- [ ] Graficos muestran estado vacio

## 2.2 Configuracion de Cursos

### TC-CFG03: Verificar cursos existentes
**Pasos:**
1. Navegar a "Cursos" en sidebar

**Resultado Esperado:**
- [ ] Lista de cursos del seed:
  - 1 Basico A
  - 2 Basico A
  - 3 Basico A
- [ ] Columnas: Nombre, Nivel, Estudiantes, Profesor Jefe

### TC-CFG04: Crear nuevo curso
**Pasos:**
1. Clic en "+ Nuevo Curso"
2. Ingresar nombre: "4 Basico A"
3. Seleccionar nivel: "4 Basico"
4. Clic en "Guardar"

**Resultado Esperado:**
- [ ] Modal se cierra
- [ ] Toast de exito
- [ ] Curso aparece en lista
- [ ] Estudiantes: 0

**Registro Creado:**
```json
{
  "name": "4 Basico A",
  "level": "4 Basico",
  "student_count": 0
}
```

### TC-CFG05: Editar curso existente
**Pasos:**
1. Clic en icono editar de "1 Basico A"
2. Cambiar nombre a "1 Basico B"
3. Guardar

**Resultado Esperado:**
- [ ] Cambio reflejado en lista
- [ ] Toast de confirmacion

### TC-CFG06: Asignar profesor jefe a curso
**Pasos:**
1. Editar curso "1 Basico A"
2. Seleccionar profesor jefe: Maria Gonzalez
3. Guardar

**Resultado Esperado:**
- [ ] Columna "Profesor Jefe" actualizada
- [ ] Profesor puede ver curso en Teacher PWA

## 2.3 Configuracion de Horarios

### TC-CFG07: Ver horarios de cursos
**Pasos:**
1. Navegar a "Horarios"
2. Seleccionar curso "1 Basico A"

**Resultado Esperado:**
- [ ] Grid de horarios por dia de semana
- [ ] Campos de hora de entrada y salida por dia
- [ ] Lunes a Viernes visible

### TC-CFG08: Configurar horario de entrada
**Pasos:**
1. Para "1 Basico A", Lunes:
   - Hora entrada: 08:00
   - Hora salida: 15:30
2. Guardar

**Resultado Esperado:**
- [ ] Horario guardado
- [ ] Toast de confirmacion
- [ ] Horario aplicado para calculo de atrasos

**Registro Creado:**
```json
{
  "course_id": 1,
  "day_of_week": 1,
  "entry_time": "08:00",
  "exit_time": "15:30"
}
```

### TC-CFG09: Copiar horario a otros dias
**Pasos:**
1. Configurar horario de Lunes
2. Clic en "Copiar a todos los dias"

**Resultado Esperado:**
- [ ] Mismo horario aplicado de Lunes a Viernes
- [ ] UI actualizada

### TC-CFG10: Crear excepcion de calendario
**Pasos:**
1. Navegar a "Excepciones"
2. Clic en "+ Nueva Excepcion"
3. Seleccionar fecha: proximo Lunes
4. Alcance: Global (todos los cursos)
5. Motivo: "Dia festivo"
6. Guardar

**Resultado Esperado:**
- [ ] Excepcion aparece en lista
- [ ] Fecha, alcance y motivo visibles
- [ ] Sistema no marcara ausentes ese dia

## 2.4 Configuracion de Dispositivos

### TC-CFG11: Registrar nuevo dispositivo kiosk
**Pasos:**
1. Navegar a "Dispositivos"
2. Clic en "+ Registrar Dispositivo"
3. Gate ID: "GATE-ENTRADA-PRINCIPAL"
4. Device ID: "KIOSK-HALL-01"
5. Version: "1.0.0"
6. Guardar

**Resultado Esperado:**
- [ ] Dispositivo aparece en lista
- [ ] Estado: "En Cola" (pendiente activacion)
- [ ] Columnas visibles: Gate, Device, Version, Estado, Ultima Sync, Bateria

**Registro Creado:**
```json
{
  "gate_id": "GATE-ENTRADA-PRINCIPAL",
  "device_id": "KIOSK-HALL-01",
  "version": "1.0.0",
  "status": "QUEUE"
}
```

### TC-CFG12: Ver lista de dispositivos
**Pasos:**
1. En "Dispositivos", verificar lista

**Resultado Esperado:**
- [ ] Todos los dispositivos registrados visibles
- [ ] Indicadores de estado por color:
  - Verde: Activo
  - Amarillo: En Cola
  - Rojo: Error/Desconectado
- [ ] Alerta de bateria baja (<50%)

### TC-CFG13: Ping a dispositivo
**Pasos:**
1. Clic en "Ping" de un dispositivo activo

**Resultado Esperado:**
- [ ] Respuesta de conectividad
- [ ] Timestamp de ultima respuesta actualizado

### TC-CFG14: Ver logs de dispositivo
**Pasos:**
1. Clic en "Ver Logs" de un dispositivo

**Resultado Esperado:**
- [ ] Modal con logs recientes
- [ ] Formato: timestamp, nivel, mensaje
- [ ] Opcion de filtrar por nivel

## 2.5 Creacion de Usuarios del Sistema

### TC-CFG15: Crear profesor adicional
**Pasos:**
1. Navegar a "Profesores"
2. Clic en "+ Nuevo Profesor"
3. Completar:
   - Nombre: "Ana Rodriguez"
   - Email: "ana.rodriguez@demo.example.com"
   - Telefono: "+56912345678"
   - Especialidad: "Matematicas"
4. Guardar

**Resultado Esperado:**
- [ ] Profesor aparece en lista
- [ ] Estado: Activo
- [ ] Usuario creado puede hacer login

**Registro Creado:**
```json
{
  "full_name": "Ana Rodriguez",
  "email": "ana.rodriguez@demo.example.com",
  "phone": "+56912345678",
  "specialty": "Matematicas",
  "is_active": true,
  "role": "TEACHER"
}
```

### TC-CFG16: Asignar cursos a profesor
**Pasos:**
1. Clic en "Asignar Cursos" del profesor
2. Seleccionar checkboxes: 1 Basico A, 2 Basico A
3. Guardar

**Resultado Esperado:**
- [ ] Columna "Cursos" muestra cursos asignados
- [ ] Profesor puede ver estos cursos en Teacher PWA

### TC-CFG17: Generar credencial QR para profesor
**Pasos:**
1. Clic en "Generar QR" del profesor

**Resultado Esperado:**
- [ ] Modal con codigo QR generado
- [ ] Opcion de descargar imagen
- [ ] Tag creado en base de datos

### TC-CFG18: Enrolar NFC para profesor
**Pasos:**
1. Clic en "Enrolar NFC" del profesor
2. Acercar tag NFC al lector

**Resultado Esperado:**
- [ ] Tag NFC leido y asociado
- [ ] Indicador de NFC activo en perfil

## 2.6 Verificacion de Configuracion

### TC-CFG19: Inspector no puede acceder a Profesores
**Precondiciones:** Login como Inspector
**Pasos:**
1. Intentar navegar a "Profesores"

**Resultado Esperado:**
- [ ] Opcion no visible en sidebar
- [ ] Acceso directo a URL redirige a dashboard
- [ ] Mensaje de acceso denegado (opcional)

### TC-CFG20: Verificar datos seeded
**Pasos:**
1. Revisar Cursos (3 cursos)
2. Revisar Profesores (3 profesores)
3. Revisar Alumnos (15 alumnos: 5 por curso)
4. Revisar Apoderados (5 apoderados)

**Resultado Esperado:**
- [ ] Todos los datos del seed presentes
- [ ] Relaciones correctas (estudiante-curso, estudiante-apoderado)

---

# FASE 3: GESTION DE DATOS MAESTROS (Director)

**Objetivo:** Crear y gestionar estudiantes, apoderados y sus relaciones

## 3.1 Gestion de Estudiantes

### TC-EST01: Ver lista de estudiantes
**Pasos:**
1. Navegar a "Alumnos"

**Resultado Esperado:**
- [ ] Lista paginada de estudiantes
- [ ] Columnas: Foto, Nombre, Curso, RUT, Estado, Acciones
- [ ] Buscador por nombre funcional
- [ ] Filtro por curso funcional

### TC-EST02: Crear nuevo estudiante completo
**Pasos:**
1. Clic en "+ Nuevo Alumno"
2. Completar formulario:
   - Nombre: "Carlos Perez Soto"
   - RUT: "21.345.678-9"
   - Curso: 1 Basico A
   - Fecha nacimiento: 01/03/2017
   - Autorizar foto: Si
3. Guardar

**Resultado Esperado:**
- [ ] Modal se cierra
- [ ] Toast de exito
- [ ] Estudiante aparece en lista del curso
- [ ] Contador del curso incrementa

**Registro Creado:**
```json
{
  "full_name": "Carlos Perez Soto",
  "rut": "21.345.678-9",
  "course_id": 1,
  "birth_date": "2017-03-01",
  "photo_pref_opt_in": true
}
```

### TC-EST03: Crear estudiante sin consentimiento de foto
**Pasos:**
1. Crear estudiante con "Autorizar foto": No

**Resultado Esperado:**
- [ ] Estudiante creado con photo_pref_opt_in=false
- [ ] Kiosk no activara camara para este estudiante

### TC-EST04: Editar estudiante existente
**Pasos:**
1. Buscar estudiante "Carlos Perez"
2. Clic en icono editar
3. Cambiar curso a "2 Basico A"
4. Guardar

**Resultado Esperado:**
- [ ] Cambio de curso reflejado
- [ ] Estudiante aparece en nuevo curso
- [ ] Contador de curso anterior decrementa
- [ ] Contador de nuevo curso incrementa

### TC-EST05: Ver perfil completo de estudiante
**Pasos:**
1. Clic en icono "Ver Perfil" de un estudiante

**Resultado Esperado:**
- [ ] Modal con informacion completa:
  - Datos personales (nombre, RUT, curso)
  - Avatar/foto
  - Estadisticas de asistencia:
    - Porcentaje de asistencia
    - Dias presente
    - Dias ausente
    - Atrasos
  - Lista de apoderados vinculados
  - Tags activos (QR/NFC)
  - Credenciales biometricas

### TC-EST06: Ver historial de asistencia de estudiante
**Pasos:**
1. En perfil de estudiante, clic en "Ver Historial"

**Resultado Esperado:**
- [ ] Tabla con ultimos 20 registros
- [ ] Columnas: Fecha, Hora, Tipo, Fuente, Puerta
- [ ] Paginacion si hay mas registros

### TC-EST07: Registro manual de asistencia
**Pasos:**
1. En perfil de estudiante, clic en "Registrar Entrada"

**Resultado Esperado:**
- [ ] Evento IN creado con source=MANUAL
- [ ] Hora actual registrada
- [ ] Lista de eventos actualizada
- [ ] Notificacion enviada a apoderado (si configurado)

**Registro Creado:**
```json
{
  "student_id": 16,
  "event_type": "IN",
  "source": "MANUAL",
  "registered_by": "director@demo.example.com"
}
```

### TC-EST08: Generar credencial QR para estudiante
**Pasos:**
1. En perfil de estudiante, clic en "Generar QR"

**Resultado Esperado:**
- [ ] Modal con codigo QR
- [ ] Token unico generado
- [ ] Opcion de descargar PNG
- [ ] Opcion de imprimir

**Tag Creado:**
```json
{
  "student_id": 16,
  "tag_type": "QR",
  "token": "qr_st_016",
  "status": "ACTIVE"
}
```

### TC-EST09: Enrolar tag NFC para estudiante
**Pasos:**
1. En perfil, clic en "Enrolar NFC"
2. Acercar tag NFC virgen al lector

**Resultado Esperado:**
- [ ] Tag leido y asociado al estudiante
- [ ] Indicador de NFC en perfil
- [ ] Segundo tag NFC puede agregarse

### TC-EST10: Eliminar estudiante
**Pasos:**
1. Clic en icono "Eliminar" de un estudiante
2. Confirmar en dialogo

**Resultado Esperado:**
- [ ] Dialogo de advertencia:
  - "Se eliminaran X registros de asistencia"
  - "Se eliminaran X tags"
- [ ] Estudiante removido de lista
- [ ] Datos relacionados eliminados (cascade)

## 3.2 Gestion de Apoderados

### TC-APO01: Ver lista de apoderados
**Pasos:**
1. Navegar a "Apoderados"

**Resultado Esperado:**
- [ ] Lista de apoderados con:
  - Nombre
  - Email
  - WhatsApp
  - Hijos vinculados (count)
  - Acciones
- [ ] Buscador funcional
- [ ] Paginacion (15 por pagina)

### TC-APO02: Crear nuevo apoderado
**Pasos:**
1. Clic en "+ Nuevo Apoderado"
2. Completar:
   - Nombre: "Roberto Martinez"
   - Email: "roberto.martinez@demo.example.com"
   - WhatsApp: "+56987654321"
   - Relacion: "Padre"
3. Guardar

**Resultado Esperado:**
- [ ] Apoderado creado
- [ ] Usuario creado con rol PARENT
- [ ] Puede hacer login al sistema

**Registros Creados:**
```json
{
  "guardian": {
    "full_name": "Roberto Martinez",
    "email": "roberto.martinez@demo.example.com",
    "whatsapp_phone": "+56987654321",
    "relationship": "Padre"
  },
  "user": {
    "email": "roberto.martinez@demo.example.com",
    "role": "PARENT"
  }
}
```

### TC-APO03: Vincular apoderado a estudiante
**Pasos:**
1. En perfil de apoderado, clic en "Vincular Estudiante"
2. Buscar estudiante "Carlos Perez"
3. Seleccionar
4. Definir relacion: "Padre"
5. Guardar

**Resultado Esperado:**
- [ ] Relacion creada
- [ ] Estudiante aparece en lista de hijos
- [ ] Apoderado recibira notificaciones del estudiante

### TC-APO04: Vincular multiples estudiantes (hermanos)
**Pasos:**
1. Vincular segundo estudiante al mismo apoderado

**Resultado Esperado:**
- [ ] Multiples hijos visibles en perfil
- [ ] Apoderado ve todos sus hijos en portal

### TC-APO05: Editar informacion de apoderado
**Pasos:**
1. Clic en editar apoderado
2. Cambiar telefono WhatsApp
3. Guardar

**Resultado Esperado:**
- [ ] Cambio reflejado
- [ ] Notificaciones futuras van al nuevo numero

### TC-APO06: Ver perfil completo de apoderado
**Pasos:**
1. Clic en "Ver Perfil" de apoderado

**Resultado Esperado:**
- [ ] Informacion de contacto
- [ ] Lista de hijos con:
  - Nombre
  - Curso
  - Ultimo evento de hoy
- [ ] Preferencias de notificacion
- [ ] Historial de notificaciones enviadas

### TC-APO07: Desvincular estudiante de apoderado
**Pasos:**
1. En perfil de apoderado, clic en "Desvincular" junto a estudiante
2. Confirmar

**Resultado Esperado:**
- [ ] Relacion eliminada
- [ ] Apoderado ya no recibe notificaciones del estudiante

### TC-APO08: Eliminar apoderado
**Pasos:**
1. Clic en eliminar apoderado
2. Confirmar

**Resultado Esperado:**
- [ ] Advertencia sobre estudiantes sin apoderado
- [ ] Usuario eliminado
- [ ] Login ya no funciona

## 3.3 Gestion de Tags y Credenciales

### TC-TAG01: Ver todos los tags activos
**Pasos:**
1. En gestion de estudiantes, filtrar por "con tag"

**Resultado Esperado:**
- [ ] Lista de estudiantes con tags
- [ ] Tipo de tag visible (QR/NFC)
- [ ] Estado del tag (Active/Pending/Revoked)

### TC-TAG02: Revocar tag de estudiante
**Pasos:**
1. En perfil de estudiante, clic en "Revocar" junto al tag
2. Confirmar

**Resultado Esperado:**
- [ ] Tag marcado como REVOKED
- [ ] Token ya no funciona en kiosk
- [ ] Estudiante puede recibir nuevo tag

### TC-TAG03: Reactivar tag revocado
**Pasos:**
1. Buscar tag revocado
2. Clic en "Reactivar"

**Resultado Esperado:**
- [ ] Tag vuelve a estado ACTIVE
- [ ] Funciona nuevamente en kiosk

### TC-TAG04: Generar tags en lote para curso
**Pasos:**
1. Navegar a Cursos
2. Seleccionar curso
3. Clic en "Generar Tags QR para todos"

**Resultado Esperado:**
- [ ] QR generado para cada estudiante sin tag
- [ ] PDF descargable con todos los QR
- [ ] Cada QR identificado con nombre

## 3.4 Gestion Biometrica

### TC-BIO01: Ver panel de biometria
**Pasos:**
1. Navegar a "Biometria"

**Resultado Esperado:**
- [ ] Panel dividido:
  - Izquierda: Selector de estudiantes
  - Derecha: Area de enrollment
- [ ] Buscador de estudiantes
- [ ] Filtro por curso
- [ ] Indicador de estado biometrico por estudiante

### TC-BIO02: Seleccionar estudiante para enrollment
**Pasos:**
1. Buscar estudiante
2. Clic en nombre

**Resultado Esperado:**
- [ ] Panel derecho muestra:
  - Foto/avatar del estudiante
  - Nombre y curso
  - Estado: "Sin huella registrada" o "X huellas registradas"
  - Lista de credenciales existentes
  - Boton "Registrar Huella"

### TC-BIO03: Registrar huella desde panel admin
**Pasos:**
1. Seleccionar estudiante sin huella
2. Clic en "Registrar Huella"
3. Seguir flujo WebAuthn

**Resultado Esperado:**
- [ ] Dialogo de WebAuthn del navegador
- [ ] Animacion de sensor en UI
- [ ] Credencial registrada
- [ ] Badge actualiza a "1 huella registrada"

### TC-BIO04: Ver detalle de credencial
**Pasos:**
1. Seleccionar estudiante con huella
2. Expandir lista de credenciales

**Resultado Esperado:**
- [ ] Informacion visible:
  - Dispositivo donde se registro
  - Fecha de registro
  - Ultimo uso (si aplica)

### TC-BIO05: Eliminar credencial individual
**Pasos:**
1. Clic en "Eliminar" de una credencial
2. Confirmar

**Resultado Esperado:**
- [ ] Credencial eliminada
- [ ] Contador decrementado
- [ ] Estudiante puede re-enrollarse

### TC-BIO06: Eliminar todas las credenciales
**Pasos:**
1. Clic en "Eliminar Todas"
2. Confirmar advertencia

**Resultado Esperado:**
- [ ] Todas las credenciales eliminadas
- [ ] Estado vuelve a "Sin huella registrada"

---

# FASE 4: OPERACION DIARIA (Director/Inspector)

**Objetivo:** Monitorear y gestionar la asistencia del dia a dia

## 4.1 Dashboard en Vivo

### TC-OPD01: Ver estadisticas del dia
**Precondiciones:** Datos de asistencia del dia generados
**Pasos:**
1. Navegar a Dashboard

**Resultado Esperado:**
- [ ] Tarjetas de resumen actualizadas:
  - Ingresos: [count de eventos IN hoy]
  - Salidas: [count de eventos OUT hoy]
  - Atrasos: [count de eventos IN con is_late=true]
  - Sin Ingreso: [estudiantes sin evento IN hoy]
- [ ] Valores reflejan datos reales

**Verificacion de Datos:**
```sql
-- Query de verificacion
SELECT
  COUNT(*) FILTER (WHERE event_type = 'IN') as ingresos,
  COUNT(*) FILTER (WHERE event_type = 'OUT') as salidas,
  COUNT(*) FILTER (WHERE event_type = 'IN' AND is_late = true) as atrasos
FROM attendance_events
WHERE DATE(occurred_at) = CURRENT_DATE;
```

### TC-OPD02: Ver tabla de eventos en tiempo real
**Pasos:**
1. En Dashboard, observar tabla de eventos

**Resultado Esperado:**
- [ ] Eventos ordenados por hora descendente
- [ ] Columnas: Hora, Alumno, Curso, Tipo, Puerta, Foto
- [ ] Icono de camara si tiene foto
- [ ] Paginacion si hay mas de 20 eventos

### TC-OPD03: Filtrar eventos por curso
**Pasos:**
1. Seleccionar filtro "Curso": 1 Basico A
2. Clic en "Aplicar"

**Resultado Esperado:**
- [ ] Solo eventos de estudiantes de 1 Basico A
- [ ] Estadisticas actualizadas al filtro
- [ ] Contador de resultados visible

### TC-OPD04: Filtrar eventos por tipo
**Pasos:**
1. Seleccionar filtro "Tipo": Entrada
2. Aplicar

**Resultado Esperado:**
- [ ] Solo eventos tipo IN visibles
- [ ] Estadisticas reflejan solo entradas

### TC-OPD05: Buscar estudiante especifico
**Pasos:**
1. En buscador, escribir "Carlos"
2. Observar resultados

**Resultado Esperado:**
- [ ] Eventos filtrados por nombre
- [ ] Busqueda parcial funciona

### TC-OPD06: Ver foto de evidencia
**Pasos:**
1. Identificar evento con icono de camara
2. Clic en "Ver Foto"

**Resultado Esperado:**
- [ ] Modal con foto del estudiante
- [ ] Fecha y hora de captura
- [ ] Opcion de cerrar modal

### TC-OPD07: Exportar eventos a CSV
**Pasos:**
1. Configurar filtros deseados
2. Clic en "Exportar CSV"

**Resultado Esperado:**
- [ ] Archivo CSV descargado
- [ ] Columnas: Fecha, Hora, Alumno, Curso, Tipo, Puerta, Fuente
- [ ] Datos coinciden con filtros aplicados

**Contenido CSV Esperado:**
```csv
Fecha,Hora,Alumno,Curso,Tipo,Puerta,Fuente
2024-12-15,08:05,Carlos Perez,1 Basico A,IN,GATE-ENTRADA-01,QR
2024-12-15,08:07,Maria Lopez,1 Basico A,IN,GATE-ENTRADA-01,NFC
```

## 4.2 Alertas de No-Show

### TC-OPD08: Ver alumnos sin registro pasado el umbral
**Precondiciones:** Hora actual > 08:30, estudiantes sin entrada
**Pasos:**
1. En Dashboard, ver seccion de alertas

**Resultado Esperado:**
- [ ] Lista de estudiantes sin entrada
- [ ] Indicador de tiempo transcurrido
- [ ] Opcion de marcar presente manualmente
- [ ] Opcion de contactar apoderado

### TC-OPD09: Marcar presente desde alerta
**Pasos:**
1. En alerta de estudiante sin registro
2. Clic en "Marcar Presente"

**Resultado Esperado:**
- [ ] Evento IN creado con source=MANUAL
- [ ] Estudiante sale de lista de alertas
- [ ] Notificacion enviada a apoderado

### TC-OPD10: Ver detalle de alerta no-show
**Pasos:**
1. Clic en nombre de estudiante en alerta

**Resultado Esperado:**
- [ ] Perfil del estudiante
- [ ] Historial reciente
- [ ] Informacion de contacto de apoderado

## 4.3 Solicitudes de Ausencia

### TC-OPD11: Ver solicitudes pendientes
**Pasos:**
1. Navegar a "Ausencias"
2. Verificar tab "Pendientes"

**Resultado Esperado:**
- [ ] Lista de solicitudes con estado PENDING
- [ ] Informacion visible:
  - Estudiante
  - Curso
  - Tipo (Enfermedad/Personal/Vacaciones/Otro)
  - Fechas (inicio-fin)
  - Comentario
  - Adjunto (si existe)
- [ ] Acciones: Aprobar, Rechazar

### TC-OPD12: Aprobar solicitud de ausencia
**Pasos:**
1. Identificar solicitud pendiente
2. Clic en "Aprobar"

**Resultado Esperado:**
- [ ] Solicitud movida a tab "Aprobadas"
- [ ] Estado: APPROVED
- [ ] Notificacion enviada a apoderado
- [ ] Estudiante no aparecera en alertas de no-show

**Notificacion Enviada:**
```json
{
  "type": "ABSENCE_APPROVED",
  "student_name": "Carlos Perez",
  "dates": "15/12 - 17/12",
  "message": "Su solicitud de ausencia ha sido aprobada"
}
```

### TC-OPD13: Rechazar solicitud con motivo
**Pasos:**
1. Identificar solicitud pendiente
2. Clic en "Rechazar"
3. (Opcional) Ingresar motivo de rechazo

**Resultado Esperado:**
- [ ] Solicitud movida a tab "Rechazadas"
- [ ] Estado: REJECTED
- [ ] Notificacion enviada a apoderado

### TC-OPD14: Ver estadisticas de ausencias
**Pasos:**
1. En "Ausencias", ver tarjetas de resumen

**Resultado Esperado:**
- [ ] Pendientes: [count]
- [ ] Aprobadas: [count]
- [ ] Rechazadas: [count]
- [ ] Graficos por tipo de ausencia

## 4.4 Gestion de Horarios y Excepciones

### TC-OPD15: Verificar calculo de atrasos
**Precondiciones:** Horario configurado: entrada 08:00
**Pasos:**
1. Registrar evento a las 08:15

**Resultado Esperado:**
- [ ] Evento marcado como is_late=true
- [ ] Aparece en contador de atrasos
- [ ] Notificacion incluye "con atraso"

### TC-OPD16: Excepcion de horario no genera atrasos
**Precondiciones:** Excepcion creada para hoy: entrada 09:00
**Pasos:**
1. Registrar evento a las 08:30

**Resultado Esperado:**
- [ ] Evento NO marcado como late
- [ ] Horario de excepcion aplicado

### TC-OPD17: Ver excepciones activas
**Pasos:**
1. Navegar a "Excepciones"

**Resultado Esperado:**
- [ ] Lista de excepciones con:
  - Fecha
  - Alcance (Global/Curso especifico)
  - Horario modificado
  - Motivo

### TC-OPD18: Eliminar excepcion
**Pasos:**
1. Clic en "Eliminar" de una excepcion
2. Confirmar

**Resultado Esperado:**
- [ ] Excepcion eliminada
- [ ] Horario normal aplica para esa fecha

## 4.5 Registro Manual y Correcciones

### TC-OPD19: Registrar entrada manual desde Dashboard
**Pasos:**
1. Buscar estudiante sin entrada
2. Clic en "Registrar Entrada"

**Resultado Esperado:**
- [ ] Dialogo de confirmacion
- [ ] Evento creado con source=MANUAL
- [ ] Estadisticas actualizadas

### TC-OPD20: Registrar salida manual
**Pasos:**
1. Buscar estudiante con entrada
2. Clic en "Registrar Salida"

**Resultado Esperado:**
- [ ] Evento OUT creado
- [ ] Hora actual registrada

### TC-OPD21: Ver eventos de estudiante especifico
**Pasos:**
1. Buscar estudiante en Dashboard
2. Clic en nombre para ver historial

**Resultado Esperado:**
- [ ] Todos los eventos del estudiante hoy
- [ ] Eventos de dias anteriores disponibles

## 4.6 Monitoreo de Dispositivos

### TC-OPD22: Ver estado de dispositivos en tiempo real
**Pasos:**
1. Navegar a "Dispositivos"

**Resultado Esperado:**
- [ ] Lista de dispositivos con:
  - Estado actual (activo/desconectado)
  - Ultima sincronizacion
  - Eventos pendientes
  - Nivel de bateria
- [ ] Alerta visual si bateria < 30%

### TC-OPD23: Ping a dispositivo desconectado
**Pasos:**
1. Identificar dispositivo sin respuesta reciente
2. Clic en "Ping"

**Resultado Esperado:**
- [ ] Intento de conexion
- [ ] Resultado: Exito o Timeout
- [ ] Timestamp actualizado si exito

### TC-OPD24: Ver eventos pendientes de dispositivo
**Pasos:**
1. Identificar dispositivo con eventos pendientes > 0
2. Clic en contador

**Resultado Esperado:**
- [ ] Lista de eventos en cola
- [ ] Estado de cada evento (pending/syncing/error)

---

# FASE 5: REPORTES, METRICAS Y GRAFICOS (Director)

**Objetivo:** Verificar generacion de reportes y visualizacion de datos

## 5.1 Reportes de Asistencia

### TC-REP01: Generar reporte semanal
**Precondiciones:** Datos de asistencia de ultima semana
**Pasos:**
1. Navegar a "Reportes"
2. Fecha inicio: hace 7 dias
3. Fecha fin: hoy
4. Clic en "Generar"

**Resultado Esperado:**
- [ ] Tabla de resumen por curso:
  - Curso
  - Total estudiantes
  - Presentes promedio
  - Atrasos promedio
  - Ausentes promedio
  - % Asistencia
- [ ] Datos calculados correctamente

**Verificacion de Datos (ejemplo):**
| Curso | Total | Presentes | Atrasos | Ausentes | % |
|-------|-------|-----------|---------|----------|---|
| 1 Basico A | 5 | 4.5 | 0.3 | 0.2 | 90% |
| 2 Basico A | 5 | 4.2 | 0.5 | 0.3 | 84% |
| 3 Basico A | 5 | 4.8 | 0.1 | 0.1 | 96% |

### TC-REP02: Verificar grafico de barras por curso
**Pasos:**
1. En reporte generado, observar grafico de barras

**Resultado Esperado:**
- [ ] Grafico visible con todos los cursos
- [ ] Barras representan % de asistencia
- [ ] Colores distintivos por curso
- [ ] Leyenda visible
- [ ] Valores en tooltips

### TC-REP03: Verificar grafico de tendencia semanal
**Pasos:**
1. Observar grafico de linea/area

**Resultado Esperado:**
- [ ] Eje X: dias de la semana
- [ ] Eje Y: % asistencia o cantidad
- [ ] Linea muestra tendencia
- [ ] Tooltips con valores exactos

### TC-REP04: Exportar reporte a PDF
**Pasos:**
1. Generar reporte
2. Clic en "Exportar PDF"

**Resultado Esperado:**
- [ ] Archivo PDF descargado
- [ ] Contiene:
  - Titulo y fecha del reporte
  - Tabla de resumen
  - Graficos
  - Footer con fecha de generacion

### TC-REP05: Reporte filtrado por curso
**Pasos:**
1. Seleccionar solo "1 Basico A"
2. Generar reporte

**Resultado Esperado:**
- [ ] Solo datos del curso seleccionado
- [ ] Detalle por estudiante disponible

### TC-REP06: Reporte de rango personalizado
**Pasos:**
1. Seleccionar rango: ultimo mes
2. Generar

**Resultado Esperado:**
- [ ] Datos del mes completo
- [ ] Tendencias mensuales visibles

## 5.2 Metricas Avanzadas

### TC-MET01: Ver dashboard de metricas
**Pasos:**
1. Navegar a "Metricas"

**Resultado Esperado:**
- [ ] KPIs principales visibles:
  - Tasa de asistencia general (%)
  - Promedio de atrasos diarios
  - Dias sin incidentes
  - Estudiantes en riesgo (count)

**Ejemplo de KPIs:**
```
Tasa Asistencia: 92%
Atrasos Promedio: 2.3/dia
Dias Sin Incidentes: 5
Estudiantes en Riesgo: 3
```

### TC-MET02: Ver top 10 estudiantes con mas atrasos
**Pasos:**
1. En Metricas, localizar tabla "Top Atrasos"

**Resultado Esperado:**
- [ ] Lista ordenada por cantidad de atrasos (desc)
- [ ] Columnas: Posicion, Nombre, Curso, Atrasos
- [ ] Maximo 10 estudiantes

**Ejemplo:**
| # | Estudiante | Curso | Atrasos |
|---|------------|-------|---------|
| 1 | Juan Perez | 1 Basico A | 8 |
| 2 | Maria Garcia | 2 Basico A | 6 |
| 3 | Carlos Lopez | 1 Basico A | 5 |

### TC-MET03: Ver grafico de distribucion de atrasos por hora
**Pasos:**
1. Localizar grafico "Distribucion por Hora"

**Resultado Esperado:**
- [ ] Grafico de barras o histograma
- [ ] Eje X: horas (07:00 - 10:00)
- [ ] Eje Y: cantidad de atrasos
- [ ] Pico visible en hora mas comun

### TC-MET04: Ver analisis de riesgo de estudiantes
**Pasos:**
1. Localizar seccion "Estudiantes en Riesgo"

**Resultado Esperado:**
- [ ] Lista de estudiantes con:
  - Mas de 3 ausencias, o
  - Mas de 5 atrasos
- [ ] Nivel de riesgo: Medio/Alto
- [ ] Detalle de metricas por estudiante

**Criterios de Riesgo:**
- Medio: 3-5 ausencias o 5-7 atrasos
- Alto: >5 ausencias o >7 atrasos

### TC-MET05: Ver tendencia de asistencia 30 dias
**Pasos:**
1. Localizar grafico de tendencia mensual

**Resultado Esperado:**
- [ ] Grafico de linea con 30 puntos
- [ ] Tendencia general visible
- [ ] Anomalias identificables (caidas)

### TC-MET06: Exportar lista de riesgo a CSV
**Pasos:**
1. Clic en "Exportar CSV" en seccion de riesgo

**Resultado Esperado:**
- [ ] CSV con estudiantes en riesgo
- [ ] Columnas: Nombre, Curso, Ausencias, Atrasos, Nivel Riesgo

### TC-MET07: Ver metricas por curso
**Pasos:**
1. Seleccionar curso especifico
2. Ver metricas filtradas

**Resultado Esperado:**
- [ ] KPIs actualizados para el curso
- [ ] Graficos filtrados
- [ ] Comparacion con promedio general

## 5.3 Verificacion de Datos en Graficos

### TC-GRF01: Verificar consistencia de datos en grafico de barras
**Pasos:**
1. Anotar valores de tabla de resumen
2. Comparar con alturas de barras en grafico

**Resultado Esperado:**
- [ ] Barras proporcionales a valores
- [ ] Tooltips muestran valores exactos
- [ ] Sin discrepancias

### TC-GRF02: Verificar actualizacion en tiempo real
**Pasos:**
1. Abrir Metricas en pantalla
2. Registrar nuevo evento desde otro dispositivo
3. Observar actualizacion

**Resultado Esperado:**
- [ ] Datos actualizados (con refresh o automatico)
- [ ] Graficos reflejan nuevo dato

### TC-GRF03: Verificar responsividad de graficos
**Pasos:**
1. Ver graficos en desktop
2. Reducir tamano de ventana
3. Ver en modo tablet
4. Ver en modo movil

**Resultado Esperado:**
- [ ] Graficos se redimensionan correctamente
- [ ] Legibilidad mantenida
- [ ] Sin desbordamiento

### TC-GRF04: Verificar estados vacios en graficos
**Pasos:**
1. Seleccionar rango sin datos

**Resultado Esperado:**
- [ ] Mensaje "Sin datos para el periodo"
- [ ] Grafico vacio o placeholder
- [ ] Sin errores de renderizado

### TC-GRF05: Interaccion con graficos
**Pasos:**
1. Hover sobre barras/puntos
2. Clic en elementos interactivos

**Resultado Esperado:**
- [ ] Tooltips visibles con detalle
- [ ] Animaciones suaves
- [ ] Filtrado al hacer clic (si aplica)

---

# FASE 6: NOTIFICACIONES Y COMUNICACIONES (Director)

**Objetivo:** Verificar sistema de notificaciones y mensajeria masiva

## 6.1 Bitacora de Notificaciones

### TC-NOT01: Ver historial de notificaciones
**Pasos:**
1. Navegar a "Notificaciones"

**Resultado Esperado:**
- [ ] Estadisticas de resumen:
  - Total enviadas
  - Entregadas
  - Fallidas
  - Pendientes
- [ ] Tabla con historial

### TC-NOT02: Ver detalle de notificacion
**Pasos:**
1. Clic en una notificacion de la lista

**Resultado Esperado:**
- [ ] Modal con detalle completo:
  - Destinatario (apoderado)
  - Estudiante relacionado
  - Tipo de evento
  - Canal (WhatsApp/Email)
  - Estado
  - Mensaje enviado
  - Timestamps (creado, enviado, entregado)
  - Error (si fallo)

### TC-NOT03: Filtrar por canal
**Pasos:**
1. Seleccionar filtro Canal: WhatsApp
2. Aplicar

**Resultado Esperado:**
- [ ] Solo notificaciones WhatsApp visibles
- [ ] Estadisticas actualizadas al filtro

### TC-NOT04: Filtrar por estado
**Pasos:**
1. Seleccionar filtro Estado: Fallidas
2. Aplicar

**Resultado Esperado:**
- [ ] Solo notificaciones con status=failed
- [ ] Mensaje de error visible

### TC-NOT05: Filtrar por tipo de evento
**Pasos:**
1. Seleccionar Tipo: NO_SHOW
2. Aplicar

**Resultado Esperado:**
- [ ] Solo alertas de no-show
- [ ] Filtro combinable con otros

### TC-NOT06: Reintentar notificacion fallida
**Pasos:**
1. Identificar notificacion fallida
2. Clic en "Reintentar"

**Resultado Esperado:**
- [ ] Estado cambia a "Pendiente"
- [ ] Notificacion re-encolada
- [ ] Toast de confirmacion

### TC-NOT07: Exportar log de notificaciones
**Pasos:**
1. Configurar filtros
2. Clic en "Exportar CSV"

**Resultado Esperado:**
- [ ] CSV con datos filtrados
- [ ] Columnas: Fecha, Destinatario, Estudiante, Tipo, Canal, Estado

## 6.2 Mensajes Broadcast

### TC-BRD01: Acceder a broadcast
**Pasos:**
1. Navegar a "Broadcast"

**Resultado Esperado:**
- [ ] Formulario de mensaje masivo
- [ ] Selector de destinatarios
- [ ] Templates predefinidos
- [ ] Editor de mensaje

### TC-BRD02: Usar template predefinido
**Pasos:**
1. Clic en template "Suspension de Clases"

**Resultado Esperado:**
- [ ] Mensaje pre-rellenado con variables:
  - {{curso}}
  - {{fecha}}
  - {{motivo}}
- [ ] Variables editables

### TC-BRD03: Seleccionar destinatarios por curso
**Pasos:**
1. Seleccionar curso: "1 Basico A"

**Resultado Esperado:**
- [ ] Contador de destinatarios actualizado
- [ ] Lista de apoderados del curso
- [ ] Preview de destinatarios disponible

### TC-BRD04: Seleccionar todos los cursos
**Pasos:**
1. Seleccionar "Todos los cursos"

**Resultado Esperado:**
- [ ] Todos los apoderados incluidos
- [ ] Contador muestra total

### TC-BRD05: Preview de mensaje
**Pasos:**
1. Completar mensaje con variables
2. Clic en "Vista Previa"

**Resultado Esperado:**
- [ ] Variables reemplazadas con valores reales
- [ ] Mensaje final visible
- [ ] Lista de destinatarios

### TC-BRD06: Enviar broadcast WhatsApp
**Pasos:**
1. Completar mensaje
2. Seleccionar canal: WhatsApp
3. Clic en "Enviar"

**Resultado Esperado:**
- [ ] Confirmacion de envio
- [ ] Progreso de entrega
- [ ] Resumen de resultados:
  - Enviados: X
  - Entregados: X
  - Fallidos: X

### TC-BRD07: Enviar broadcast Email
**Pasos:**
1. Completar mensaje
2. Seleccionar canal: Email
3. Clic en "Enviar"

**Resultado Esperado:**
- [ ] Emails encolados
- [ ] Resumen de envio
- [ ] Notificaciones aparecen en bitacora

### TC-BRD08: Enviar broadcast dual (WhatsApp + Email)
**Pasos:**
1. Seleccionar ambos canales
2. Enviar

**Resultado Esperado:**
- [ ] Mensaje enviado por ambos canales
- [ ] Dos notificaciones por destinatario en bitacora

## 6.3 Push Notifications

### TC-PSH01: Ver suscripciones push activas
**Pasos:**
1. En perfil de apoderado, ver suscripciones

**Resultado Esperado:**
- [ ] Lista de dispositivos suscritos
- [ ] Fecha de suscripcion
- [ ] Navegador/dispositivo

### TC-PSH02: Verificar entrega de push
**Precondiciones:** Apoderado con push habilitado
**Pasos:**
1. Registrar evento de estudiante
2. Verificar recepcion en dispositivo del apoderado

**Resultado Esperado:**
- [ ] Notificacion push recibida
- [ ] Titulo y mensaje correctos
- [ ] Clic lleva a la app

---

# FASE 7: PORTAL DE APODERADOS (Parent)

**URL:** /app
**Rol:** Apoderado
**Objetivo:** Verificar funcionalidad completa del portal de padres

## 7.1 Acceso y Home

### TC-PAR01: Login y redireccion automatica
**Pasos:**
1. Login como apoderado

**Resultado Esperado:**
- [ ] Redireccion directa a /app (sin selector)
- [ ] Vista de apoderado cargada
- [ ] NO hay sidebar de administrador

### TC-PAR02: Ver tarjetas de hijos
**Pasos:**
1. En home, observar tarjetas

**Resultado Esperado:**
- [ ] Una tarjeta por cada hijo vinculado
- [ ] Informacion visible:
  - Nombre del estudiante
  - Curso
  - Estado actual (Ingreso/Salida/Sin registro)
  - Hora y puerta si aplica

### TC-PAR03: Estados visuales por tipo
**Verificar:**
- [ ] Ingreso on-time: Check verde, "Ingreso a las HH:MM"
- [ ] Ingreso con atraso: Warning amarillo, "Ingreso tarde a las HH:MM"
- [ ] Sin ingreso: Signo de interrogacion, "Sin registro"
- [ ] Salida: Icono casa, "Salio a las HH:MM"

## 7.2 Historial de Asistencia

### TC-PAR04: Ver historial de un hijo
**Pasos:**
1. Clic en "Ver Historial" de un hijo

**Resultado Esperado:**
- [ ] Tabla con eventos del estudiante
- [ ] Columnas: Fecha, Hora, Tipo, Fuente
- [ ] Ultimos 20 registros por defecto
- [ ] Solo datos del hijo seleccionado

### TC-PAR05: Filtrar historial por fecha
**Pasos:**
1. Seleccionar rango de fechas
2. Clic en "Buscar"

**Resultado Esperado:**
- [ ] Tabla filtrada por rango
- [ ] Navegacion entre paginas si hay muchos resultados

### TC-PAR06: Seguridad - no puede ver otros estudiantes
**Pasos:**
1. Intentar modificar URL con ID de estudiante no vinculado

**Resultado Esperado:**
- [ ] Error 403 o redireccion
- [ ] No muestra datos de otros estudiantes
- [ ] Log de intento de acceso

## 7.3 Preferencias de Notificacion

### TC-PAR07: Ver preferencias actuales
**Pasos:**
1. Navegar a "Preferencias"

**Resultado Esperado:**
- [ ] Seccion de canales de notificacion
- [ ] Estados actuales de cada preferencia
- [ ] Tipos de evento configurables:
  - INGRESO_OK
  - SALIDA_OK
  - NO_INGRESO_UMBRAL
  - CAMBIO_HORARIO

### TC-PAR08: Configurar canales por tipo de evento
**Pasos:**
1. Para INGRESO_OK:
   - Activar WhatsApp
   - Desactivar Email
2. Para NO_INGRESO_UMBRAL:
   - Activar ambos canales
3. Guardar

**Resultado Esperado:**
- [ ] Toast de exito
- [ ] Preferencias persistidas
- [ ] Futuras notificaciones respetan configuracion

### TC-PAR09: Configurar consentimiento de foto por hijo
**Pasos:**
1. En seccion "Preferencias de Evidencia"
2. Para hijo 1: Activar "Permitir foto"
3. Para hijo 2: Desactivar
4. Guardar

**Resultado Esperado:**
- [ ] Preferencias guardadas
- [ ] Kiosk respeta configuracion por estudiante

### TC-PAR10: Suscribirse a push notifications
**Pasos:**
1. En Preferencias, seccion "Push"
2. Clic en "Habilitar notificaciones push"
3. Aceptar permiso del navegador

**Resultado Esperado:**
- [ ] Suscripcion creada
- [ ] Dispositivo listado
- [ ] Push notifications activas

### TC-PAR11: Desuscribirse de push
**Pasos:**
1. Clic en "Deshabilitar push"

**Resultado Esperado:**
- [ ] Suscripcion eliminada
- [ ] No recibe mas push

## 7.4 Solicitudes de Ausencia

### TC-PAR12: Crear solicitud de ausencia
**Pasos:**
1. Navegar a "Ausencias"
2. Clic en "Nueva Solicitud"
3. Seleccionar hijo
4. Tipo: Enfermedad
5. Fecha inicio: manana
6. Fecha fin: pasado manana
7. Comentario: "Resfrio"
8. Adjuntar certificado (opcional)
9. Enviar

**Resultado Esperado:**
- [ ] Solicitud creada con estado PENDING
- [ ] Aparece en tab "Pendientes"
- [ ] Notificacion a administrador

### TC-PAR13: Ver mis solicitudes
**Pasos:**
1. Revisar tabs: Pendientes, Aprobadas, Rechazadas

**Resultado Esperado:**
- [ ] Solicitudes categorizadas por estado
- [ ] Solo solicitudes propias visibles
- [ ] Detalle de cada solicitud

### TC-PAR14: Cancelar solicitud pendiente
**Pasos:**
1. Identificar solicitud pendiente
2. Clic en "Cancelar"

**Resultado Esperado:**
- [ ] Solicitud eliminada
- [ ] No aparece mas en lista

## 7.5 Autenticacion Passkey

### TC-PAR15: Registrar passkey
**Pasos:**
1. En Preferencias, seccion "Seguridad"
2. Clic en "Agregar Passkey"
3. Completar autenticacion biometrica

**Resultado Esperado:**
- [ ] Passkey registrada
- [ ] Dispositivo listado
- [ ] Puede hacer login sin password

### TC-PAR16: Login con passkey
**Pasos:**
1. Cerrar sesion
2. En login, clic en "Usar Passkey"
3. Autenticar con biometria

**Resultado Esperado:**
- [ ] Login exitoso sin password
- [ ] Sesion iniciada correctamente

### TC-PAR17: Eliminar passkey
**Pasos:**
1. En lista de passkeys, clic en "Eliminar"

**Resultado Esperado:**
- [ ] Passkey eliminada
- [ ] Login con esa passkey ya no funciona

## 7.6 PWA y Offline

### TC-PAR18: Instalar PWA
**Pasos:**
1. En Chrome, clic en "Instalar"
2. O agregar a pantalla de inicio

**Resultado Esperado:**
- [ ] App instalada
- [ ] Icono en pantalla de inicio
- [ ] Abre en modo standalone

---

# FASE 8: TEACHER PWA (Profesor)

**URL:** /teacher
**Rol:** Profesor

## 8.1 Acceso y Cursos

### TC-TEA01: Login y ver cursos asignados
**Pasos:**
1. Login como profesor
2. Seleccionar "Portal Profesores"

**Resultado Esperado:**
- [ ] Vista de cursos cargada
- [ ] Saludo personalizado segun hora
- [ ] Tarjetas de cursos asignados
- [ ] Boton "Cambiar Aplicacion" visible

### TC-TEA02: Seleccionar curso
**Pasos:**
1. Clic en tarjeta de curso

**Resultado Esperado:**
- [ ] Redireccion a nomina del curso
- [ ] Curso guardado como actual
- [ ] Lista de estudiantes visible

## 8.2 Nomina y Registro

### TC-TEA03: Ver nomina del curso
**Pasos:**
1. En vista de nomina

**Resultado Esperado:**
- [ ] Lista de estudiantes del curso
- [ ] Columnas: Foto, Nombre, Estado, Acciones
- [ ] Estado actual de cada estudiante

### TC-TEA04: Registrar entrada individual
**Pasos:**
1. Clic en boton verde (IN) de estudiante sin entrada

**Resultado Esperado:**
- [ ] Evento IN creado
- [ ] Estado actualiza a "Ingreso HH:MM"
- [ ] Boton cambia a gris (OUT)

### TC-TEA05: Registrar salida individual
**Pasos:**
1. Clic en boton gris (OUT) de estudiante con entrada

**Resultado Esperado:**
- [ ] Evento OUT creado
- [ ] Estado actualiza a "Salio HH:MM"

### TC-TEA06: Ver perfil de estudiante
**Pasos:**
1. Clic en avatar/nombre del estudiante

**Resultado Esperado:**
- [ ] Modal con perfil:
  - Avatar con iniciales
  - Nombre completo
  - Porcentaje de asistencia
  - Estadisticas del periodo

## 8.3 Escaneo QR

### TC-TEA07: Escanear QR de estudiante
**Pasos:**
1. Clic en "Escanear QR"
2. Escanear codigo de estudiante

**Resultado Esperado:**
- [ ] Estudiante identificado
- [ ] Evento registrado automaticamente
- [ ] Retorno a nomina

### TC-TEA08: Escaneo de estudiante de otro curso
**Pasos:**
1. Escanear QR de estudiante no asignado

**Resultado Esperado:**
- [ ] Mensaje: "Estudiante no pertenece a sus cursos"
- [ ] No se registra evento

## 8.4 Marcado en Lote

### TC-TEA09: Abrir marcado en lote
**Pasos:**
1. Clic en "Marcado en Lote"

**Resultado Esperado:**
- [ ] Lista de todos los estudiantes
- [ ] Selector de estado por cada uno:
  - Presente
  - Tarde
  - Ausente
- [ ] Estado actual pre-seleccionado

### TC-TEA10: Marcar asistencia masiva
**Pasos:**
1. Cambiar estados:
   - Estudiante 1: Presente
   - Estudiante 2: Tarde
   - Estudiante 3: Ausente
2. Clic en "Enviar a Cola"

**Resultado Esperado:**
- [ ] Eventos IN creados para Presente y Tarde
- [ ] Tarde marcado con is_late=true
- [ ] Ausente no genera evento
- [ ] Toast con cantidad encolada

### TC-TEA11: Evitar duplicados en lote
**Precondiciones:** Algunos estudiantes ya tienen entrada
**Pasos:**
1. Intentar marcado en lote

**Resultado Esperado:**
- [ ] Estudiantes con entrada ya marcada aparecen disabled
- [ ] Solo se crean eventos para quienes no tienen

## 8.5 Alertas

### TC-TEA12: Ver alumnos sin registro
**Pasos:**
1. Navegar a "Alertas"

**Resultado Esperado:**
- [ ] Tarjetas de resumen:
  - Presentes: X
  - Sin Registro: Y
  - Total: Z
- [ ] Lista de estudiantes sin entrada
- [ ] Banner de alerta segun umbral

### TC-TEA13: Marcar presente desde alertas
**Pasos:**
1. Clic en "Presente" de alumno sin registro

**Resultado Esperado:**
- [ ] Evento IN creado
- [ ] Alumno sale de lista de alertas
- [ ] Contador actualizado

### TC-TEA14: Marcar todos como presentes
**Pasos:**
1. Clic en "Marcar Todos"

**Resultado Esperado:**
- [ ] Todos los sin registro marcados
- [ ] Toast con cantidad
- [ ] Lista de alertas vacia

## 8.6 Historial y Cola

### TC-TEA15: Ver historial con filtros
**Pasos:**
1. Navegar a "Historial"
2. Filtrar por fecha y tipo

**Resultado Esperado:**
- [ ] Eventos filtrados
- [ ] Solo eventos de cursos asignados

### TC-TEA16: Ver cola de sincronizacion
**Pasos:**
1. Navegar a "Cola"

**Resultado Esperado:**
- [ ] Tabs: Pendientes, Sincronizados, Errores
- [ ] Contadores por estado
- [ ] Boton "Sincronizar Ahora"

### TC-TEA17: Sincronizar manualmente
**Pasos:**
1. Clic en "Sincronizar Ahora"

**Resultado Esperado:**
- [ ] Eventos pendientes procesados
- [ ] Estados actualizados
- [ ] Toast de resultado

## 8.7 Modo Offline

### TC-TEA18: Operar sin conexion
**Pasos:**
1. Desconectar red (o simular offline)
2. Registrar varios eventos
3. Verificar cola

**Resultado Esperado:**
- [ ] App funciona sin conexion
- [ ] Eventos encolados localmente
- [ ] Badge de offline visible
- [ ] Sincronizacion al reconectar

## 8.8 Navegacion

### TC-TEA19: Cambiar de curso
**Pasos:**
1. En nav inferior, clic en icono de cursos
2. Seleccionar otro curso

**Resultado Esperado:**
- [ ] Vista actualizada con nuevo curso
- [ ] Nomina del nuevo curso visible

### TC-TEA20: Usar navegacion inferior
**Pasos:**
1. Navegar entre: Cursos, Nomina, Alertas, Historial, Cola

**Resultado Esperado:**
- [ ] Navegacion fluida
- [ ] Estado preservado
- [ ] Icono activo resaltado

### TC-TEA21: Ir a Kiosk desde Teacher
**Pasos:**
1. Clic en "Cambiar Aplicacion"
2. Seleccionar "Modo Kiosco"

**Resultado Esperado:**
- [ ] Redireccion a /kiosk
- [ ] Sesion preservada
- [ ] Puede usar admin panel

### TC-TEA22: Instalar PWA
**Pasos:**
1. Agregar a pantalla de inicio

**Resultado Esperado:**
- [ ] App instalada
- [ ] Funciona offline
- [ ] Icono distintivo

---

# FASE 9: SUPER ADMIN MULTI-TENANT

**URL:** /app#/super-admin
**Rol:** Super Admin

## 9.1 Acceso

### TC-SA01: Login y acceso a Super Admin
**Pasos:**
1. Login como Super Admin
2. Seleccionar "Panel Super Admin"

**Resultado Esperado:**
- [ ] Dashboard multi-tenant cargado
- [ ] Vista de instituciones
- [ ] Estadisticas globales

## 9.2 Gestion de Tenants

### TC-SA02: Ver lista de tenants
**Pasos:**
1. En dashboard, ver lista de instituciones

**Resultado Esperado:**
- [ ] Todos los tenants listados
- [ ] Columnas: Nombre, Dominio, Plan, Estudiantes, Estado
- [ ] Filtros disponibles

### TC-SA03: Ver detalle de tenant
**Pasos:**
1. Clic en nombre de tenant

**Resultado Esperado:**
- [ ] Vista detallada:
  - Configuracion
  - Estadisticas de uso
  - Usuarios
  - Features habilitados

### TC-SA04: Crear nuevo tenant
**Pasos:**
1. Clic en "Nuevo Tenant"
2. Completar formulario:
   - Nombre: "Colegio Test"
   - Slug: "colegio-test"
   - Plan: Pro
   - Admin email: "admin@test.cl"
3. Guardar

**Resultado Esperado:**
- [ ] Tenant creado
- [ ] Schema de base de datos creado
- [ ] Email de invitacion enviado al admin

### TC-SA05: Activar/Desactivar tenant
**Pasos:**
1. Clic en toggle de estado de un tenant

**Resultado Esperado:**
- [ ] Estado cambiado
- [ ] Tenant desactivado no permite login
- [ ] Datos preservados

### TC-SA06: Modificar plan de tenant
**Pasos:**
1. Editar tenant
2. Cambiar plan de "Basico" a "Pro"

**Resultado Esperado:**
- [ ] Plan actualizado
- [ ] Features adicionales disponibles

## 9.3 Feature Flags

### TC-SA07: Ver features de tenant
**Pasos:**
1. En detalle de tenant, ver Features

**Resultado Esperado:**
- [ ] Lista de features con toggles
- [ ] Estado actual de cada feature

### TC-SA08: Habilitar/Deshabilitar feature
**Pasos:**
1. Toggle de feature "Biometria"

**Resultado Esperado:**
- [ ] Feature deshabilitado no aparece en web-app
- [ ] Cambio inmediato

## 9.4 Acceso Cross-Tenant

### TC-SA09: Impersonar tenant
**Pasos:**
1. Clic en "Acceder como Admin" de un tenant

**Resultado Esperado:**
- [ ] Sesion de director del tenant
- [ ] Datos del tenant visible
- [ ] Header indica impersonation

### TC-SA10: Volver a Super Admin
**Pasos:**
1. Desde impersonation, clic en "Volver a Super Admin"

**Resultado Esperado:**
- [ ] Retorno a dashboard multi-tenant
- [ ] Sesion de super admin restaurada

## 9.5 Monitoreo Global

### TC-SA11: Ver estadisticas globales
**Pasos:**
1. En dashboard, ver KPIs globales

**Resultado Esperado:**
- [ ] Total tenants
- [ ] Total estudiantes (todos los tenants)
- [ ] Eventos hoy (global)
- [ ] Tenants activos vs inactivos

### TC-SA12: Ver uso por tenant
**Pasos:**
1. Ver tabla de uso

**Resultado Esperado:**
- [ ] Estudiantes por tenant
- [ ] Eventos por tenant
- [ ] Storage usado

## 9.6 Setup de Tenant

### TC-SA13: Flujo de setup publico
**URL:** /app#/setup
**Pasos:**
1. Navegar a URL de setup
2. Completar formulario de registro
3. Enviar

**Resultado Esperado:**
- [ ] Tenant creado
- [ ] Admin creado
- [ ] Redireccion a login

### TC-SA14: Validacion de slug unico
**Pasos:**
1. Intentar crear tenant con slug existente

**Resultado Esperado:**
- [ ] Error de validacion
- [ ] Mensaje claro

### TC-SA15: Activacion de admin via link
**Pasos:**
1. Usar link de activacion del email

**Resultado Esperado:**
- [ ] Pagina de configuracion de password
- [ ] Admin puede hacer login despues

---

# FASE 10: ESCENARIOS END-TO-END

**Objetivo:** Verificar flujos completos de operacion

## 10.1 Flujo Completo de Dia Escolar

### TC-E2E01: Inicio de jornada - Multiples ingresos
**Precondiciones:** Sistema configurado, kiosk activo
**Pasos:**
1. 07:55 - Estudiante 1 escanea QR (puntual)
2. 08:05 - Estudiante 2 escanea NFC (puntual)
3. 08:15 - Estudiante 3 usa huella (tarde)
4. 08:35 - Estudiante 4 sin registro (genera alerta)

**Resultado Esperado:**
- [ ] 3 eventos IN creados
- [ ] Estudiante 3 marcado como late
- [ ] Notificaciones enviadas a apoderados
- [ ] Alerta de no-show para Estudiante 4
- [ ] Dashboard actualizado en tiempo real

### TC-E2E02: Flujo de ausencia aprobada
**Pasos:**
1. Apoderado crea solicitud de ausencia para manana
2. Director recibe notificacion
3. Director aprueba solicitud
4. Apoderado recibe confirmacion
5. Al dia siguiente, estudiante no aparece en alertas

**Resultado Esperado:**
- [ ] Solicitud fluye por todos los estados
- [ ] Notificaciones enviadas en cada paso
- [ ] Sistema no genera alerta para estudiante ausente aprobado

### TC-E2E03: Fin de jornada - Salidas
**Pasos:**
1. 15:30 - Estudiantes escanean salida
2. Apoderados reciben notificaciones de salida

**Resultado Esperado:**
- [ ] Eventos OUT creados
- [ ] Notificaciones de salida enviadas
- [ ] Dashboard refleja salidas

## 10.2 Flujo de Nuevo Estudiante

### TC-E2E04: Alta completa de estudiante
**Pasos:**
1. Director crea estudiante
2. Director crea apoderado
3. Director vincula apoderado a estudiante
4. Director genera QR para estudiante
5. Estudiante usa QR en kiosk
6. Apoderado recibe notificacion

**Resultado Esperado:**
- [ ] Estudiante operativo en sistema
- [ ] QR funciona en kiosk
- [ ] Apoderado vinculado recibe alertas

### TC-E2E05: Enrollment biometrico completo
**Pasos:**
1. Profesor accede a kiosk con credencial
2. Busca estudiante en admin panel
3. Registra huella del estudiante
4. Estudiante usa huella para ingresar
5. Evento registrado correctamente

**Resultado Esperado:**
- [ ] Huella registrada
- [ ] Autenticacion biometrica funciona
- [ ] Evento con source=BIOMETRIC

## 10.3 Flujo de Comunicacion Masiva

### TC-E2E06: Broadcast de suspension de clases
**Pasos:**
1. Director crea excepcion para manana (dia festivo)
2. Director envia broadcast "Suspension de clases"
3. Todos los apoderados reciben mensaje
4. Al dia siguiente, no hay alertas de no-show

**Resultado Esperado:**
- [ ] Excepcion creada
- [ ] Broadcast enviado a todos
- [ ] Sistema no genera alertas en dia de excepcion

### TC-E2E07: Notificacion de atraso y seguimiento
**Pasos:**
1. Estudiante llega tarde (08:20)
2. Apoderado recibe notificacion de atraso
3. Director ve en metricas el atraso
4. Estudiante acumula 5 atrasos
5. Aparece en lista de riesgo

**Resultado Esperado:**
- [ ] Flujo completo de atrasos
- [ ] Metricas actualizadas
- [ ] Alertas de riesgo generadas

## 10.4 Flujos de Error y Recuperacion

### TC-E2E08: Kiosk offline y sincronizacion
**Pasos:**
1. Desconectar kiosk de red
2. Registrar 5 eventos en kiosk
3. Verificar cola pendiente
4. Reconectar kiosk
5. Sincronizar

**Resultado Esperado:**
- [ ] Eventos encolados offline
- [ ] Sincronizacion exitosa al reconectar
- [ ] Todos los eventos en servidor
- [ ] Notificaciones enviadas (retrasadas)

### TC-E2E09: Notificacion fallida y reintento
**Pasos:**
1. Simular fallo de WhatsApp (token invalido)
2. Registrar evento
3. Verificar notificacion fallida en bitacora
4. Corregir configuracion
5. Reintentar notificacion

**Resultado Esperado:**
- [ ] Fallo registrado
- [ ] Reintento exitoso
- [ ] Notificacion entregada

### TC-E2E10: Cambio de curso de estudiante
**Pasos:**
1. Estudiante pertenece a 1 Basico A
2. Director cambia a 2 Basico A
3. Profesor de 1 Basico ya no ve al estudiante
4. Profesor de 2 Basico ve al estudiante
5. Horarios del nuevo curso aplican

**Resultado Esperado:**
- [ ] Cambio de curso exitoso
- [ ] Permisos de profesores actualizados
- [ ] Horarios correctos aplicados

## 10.5 Flujos Multi-Usuario

### TC-E2E11: Operacion simultanea
**Pasos:**
1. Director monitorea en Dashboard
2. Profesor marca asistencia en Teacher PWA
3. Kiosk registra eventos QR
4. Apoderado revisa portal

**Resultado Esperado:**
- [ ] Todos los usuarios operan sin conflictos
- [ ] Datos consistentes en todas las vistas
- [ ] Actualizaciones en tiempo real

### TC-E2E12: Sesiones multiples del mismo usuario
**Pasos:**
1. Director abre sesion en desktop
2. Director abre sesion en tablet
3. Realizar acciones en ambas

**Resultado Esperado:**
- [ ] Ambas sesiones activas
- [ ] Datos sincronizados entre dispositivos
- [ ] Sin conflictos de sesion

---

# Anexos

## A. Tokens de Prueba

### QR Tokens (Estudiantes)
| Token | Estudiante | Curso | Estado |
|-------|------------|-------|--------|
| qr_st_001 | Estudiante 1 | 1 Basico A | ACTIVE |
| qr_st_002 | Estudiante 2 | 1 Basico A | ACTIVE |
| qr_st_003 | Estudiante 3 | 1 Basico A | ACTIVE |
| ... | ... | ... | ... |
| qr_st_015 | Estudiante 15 | 3 Basico A | ACTIVE |

### NFC Tokens (Estudiantes)
| Token | Estudiante | Curso | Estado |
|-------|------------|-------|--------|
| nfc_st_001 | Estudiante 1 | 1 Basico A | ACTIVE |
| nfc_st_002 | Estudiante 2 | 1 Basico A | ACTIVE |
| ... | ... | ... | ... |

### Tokens de Profesores
| Token | Profesor | Tipo |
|-------|----------|------|
| nfc_teacher_001 | Maria Gonzalez | NFC |
| nfc_teacher_002 | Pedro Ramirez | NFC |
| qr_teacher_003 | Carmen Silva | QR |

### Tokens Especiales
| Token | Proposito |
|-------|-----------|
| qr_revoked_001 | Token revocado (para pruebas de error) |
| nfc_pending_001 | Token pendiente de activacion |

## B. Configuracion de Kiosk de Prueba

```json
{
  "gate_id": "GATE-ENTRADA-01",
  "device_id": "KIOSK-001",
  "language": "es",
  "photo_enabled": true,
  "offline_mode": false,
  "sync_interval": 30000
}
```

## C. Horarios de Prueba

| Curso | Dia | Entrada | Salida |
|-------|-----|---------|--------|
| 1 Basico A | Lun-Vie | 08:00 | 15:30 |
| 2 Basico A | Lun-Vie | 08:00 | 15:30 |
| 3 Basico A | Lun-Vie | 08:00 | 16:00 |

## D. Criterios de Aceptacion

1. **Responsividad:** Todas las vistas deben funcionar en desktop (1920x1080), tablet (768x1024), y movil (375x667)
2. **Performance:** Carga inicial < 3s, navegacion < 1s, API responses < 500ms
3. **Accesibilidad:** Navegacion por teclado, contraste WCAG AA, lectores de pantalla
4. **Offline:** Kiosk y Teacher PWA deben funcionar sin conexion
5. **Seguridad:** XSS prevenido, CSRF tokens, validacion de roles, datos aislados por tenant
6. **Consistencia:** Datos consistentes entre todas las vistas y dispositivos

## E. Matriz de Prioridad

| Prioridad | Descripcion | Casos |
|-----------|-------------|-------|
| P0 - Critico | Login, registro de asistencia, notificaciones | TC-L01, TC-K04, TC-NOT01 |
| P1 - Alto | CRUD de entidades, reportes basicos | TC-EST02, TC-REP01 |
| P2 - Medio | Metricas avanzadas, broadcast, biometria | TC-MET01, TC-BRD01 |
| P3 - Bajo | Features secundarios, edge cases | TC-K16, TC-E2E08 |

## F. Checklist de Regresion

Ejecutar antes de cada release:
- [ ] TC-L01: Login Director
- [ ] TC-L04: Login Apoderado
- [ ] TC-K04: Registro entrada QR
- [ ] TC-K05: Registro salida QR
- [ ] TC-EST02: Crear estudiante
- [ ] TC-APO02: Crear apoderado
- [ ] TC-OPD01: Dashboard estadisticas
- [ ] TC-REP01: Generar reporte
- [ ] TC-NOT06: Reintentar notificacion
- [ ] TC-E2E01: Flujo dia completo

---

**Documento generado:** 2024-12-15
**Proxima revision:** Al agregar nuevas funcionalidades
