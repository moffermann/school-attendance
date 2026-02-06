# NEUVOX School Attendance
## Sistema Integral de Control de Asistencia Escolar

---

## Resumen Ejecutivo

**NEUVOX School Attendance** es una plataforma SaaS moderna y completa para la gestión de asistencia escolar, diseñada para colegios, redes educativas y distritos escolares. Combina tecnología de vanguardia con una experiencia de usuario intuitiva para automatizar el control de asistencia, mantener a los padres informados en tiempo real y proporcionar a los administradores herramientas poderosas de gestión y reportería.

### Propuesta de Valor

| Beneficio | Descripción |
|-----------|-------------|
| **Seguridad** | Los padres saben exactamente cuándo sus hijos ingresan y salen del colegio |
| **Automatización** | Elimina el registro manual propenso a errores |
| **Comunicación** | Notificaciones instantáneas por WhatsApp, Email y Push |
| **Visibilidad** | Dashboard en tiempo real para directores e inspectores |
| **Escalabilidad** | Arquitectura multi-tenant para redes de colegios |

---

## Funcionalidades Principales

### 1. Registro de Asistencia Multi-Modal

El sistema soporta múltiples métodos de identificación para adaptarse a las necesidades de cada institución:

| Método | Descripción | Ideal para |
|--------|-------------|------------|
| **Código QR** | Escaneo rápido de credencial | Alto volumen de estudiantes |
| **Tarjeta NFC** | Lectura por proximidad | Acceso controlado |
| **Biometría (Huella)** | Autenticación WebAuthn | Máxima seguridad, sin credenciales físicas |
| **Registro Manual** | Ingreso por personal | Casos excepcionales |

**Características adicionales:**
- Captura de foto como evidencia de asistencia
- Soporte para múltiples puertas/portones de acceso
- Registro de hora exacta con marca de tiempo del servidor
- Trazabilidad completa del dispositivo de registro

---

### 2. Portal de Apoderados (App Móvil PWA)

Aplicación web progresiva instalable en cualquier dispositivo móvil:

#### Funcionalidades para Padres
- **Notificaciones en tiempo real** cuando el estudiante ingresa o sale
- **Historial de asistencia** con filtros por fecha
- **Solicitudes de ausencia** con carga de justificativos
- **Preferencias de notificación** personalizables por canal
- **Autenticación biométrica** (huella/Face ID) sin contraseñas

#### Experiencia de Usuario
- Funciona sin conexión (offline-first)
- Instalable como app nativa
- Sincronización automática al recuperar conexión
- Interfaz intuitiva en español

---

### 3. Sistema de Notificaciones Multi-Canal

Comunicación instantánea con los apoderados a través de múltiples canales:

#### Canales Disponibles

| Canal | Características |
|-------|-----------------|
| **WhatsApp** | Integración oficial con WhatsApp Business API, mensajes con fotos |
| **Email** | Plantillas HTML profesionales, soporte SMTP y AWS SES |
| **Push** | Notificaciones nativas en el navegador/móvil |

#### Tipos de Notificaciones

| Evento | Descripción |
|--------|-------------|
| **Ingreso Confirmado** | Notifica cuando el estudiante registra su llegada |
| **Salida Confirmada** | Notifica cuando el estudiante registra su salida |
| **Alerta de No Ingreso** | Alerta si el estudiante no ha llegado después del umbral configurado |
| **Cambio de Horario** | Informa sobre modificaciones en el horario escolar |
| **Comunicados** | Mensajes masivos del establecimiento |

#### Preferencias Personalizables
- Cada apoderado elige qué notificaciones recibir
- Configuración independiente por canal (WhatsApp sí, Email no, etc.)
- Consentimiento de fotos por estudiante

---

### 4. Panel de Administración (Director/Inspector)

Herramientas completas para la gestión del establecimiento:

#### Dashboard en Tiempo Real
- Resumen de asistencia del día
- Conteo de ingresos y salidas
- Alertas de estudiantes sin registro
- Búsqueda rápida de estudiantes
- Estadísticas por curso

#### Gestión de Datos Maestros

| Entidad | Operaciones |
|---------|-------------|
| **Estudiantes** | Alta, baja, modificación, importación masiva CSV, foto |
| **Cursos** | Creación de cursos, asignación de niveles |
| **Docentes** | Registro de profesores, permisos de enrolamiento |
| **Apoderados** | Registro con datos de contacto, vinculación a estudiantes |
| **Horarios** | Configuración de horarios por día y curso |

#### Funciones Avanzadas
- **Comunicados masivos**: Envío de mensajes a todos los apoderados o por curso
- **Gestión de solicitudes de ausencia**: Aprobar/rechazar justificativos
- **Exportación de datos**: CSV para análisis externo
- **Administración de dispositivos kiosko**: Estado, configuración, logs
- **Gestión de credenciales biométricas**: Ver y revocar huellas registradas

---

### 5. Gestión de Ausencias

Flujo completo para el manejo de inasistencias:

#### Para Apoderados
1. Enviar solicitud de ausencia desde el portal
2. Especificar fechas, tipo de ausencia y justificación
3. Adjuntar documentos de respaldo (certificados médicos, etc.)
4. Seguimiento del estado de la solicitud

#### Para Administradores
1. Revisar solicitudes pendientes
2. Aprobar con un clic o rechazar con comentario
3. Visualizar historial por estudiante
4. Exportar reportes de ausencias

#### Tipos de Ausencia
- Justificada
- Médica
- Permiso especial
- Otra

---

### 6. Alertas Automáticas de No Ingreso

Sistema proactivo de detección de ausencias no justificadas:

#### Funcionamiento
1. El sistema conoce el horario de cada curso
2. Si un estudiante no registra ingreso pasado el umbral (configurable)
3. Se genera una alerta automática
4. Se notifica al apoderado por los canales configurados

#### Beneficios
- Detección temprana de situaciones de riesgo
- Padres informados antes de que termine la jornada
- Reducción de carga administrativa
- Trazabilidad completa de alertas

---

### 7. Reportería y Análisis

Información para la toma de decisiones:

#### Reportes Disponibles
- **Resumen de asistencia** por estudiante, curso o fecha
- **Historial de notificaciones** con estado de entrega
- **Solicitudes de ausencia** con estadísticas
- **Estado de dispositivos** y última sincronización

#### Exportaciones
- Formato CSV compatible con Excel
- Filtros por rango de fechas
- Selección de campos a exportar
- Protección contra inyección de fórmulas

---

### 8. Dispositivos Kiosko

Terminales de registro de asistencia:

#### Características del Hardware
- Pantalla táctil para interacción
- Lector de códigos QR integrado
- Lector NFC opcional
- Sensor de huella dactilar (biometría)
- Cámara para captura de evidencia

#### Gestión Remota
- Monitoreo de estado online/offline
- Sincronización automática de datos
- Actualización de firmware remota
- Registro de eventos pendientes en caso de desconexión
- Heartbeat para detección de problemas

#### Sincronización Inteligente
- Bootstrap inicial con todos los datos necesarios
- Actualizaciones incrementales
- Fotos de estudiantes en alta resolución
- Funcionamiento offline con cola de eventos

---

### 9. Seguridad y Autenticación

Múltiples capas de seguridad:

#### Autenticación de Usuarios

| Rol | Métodos Disponibles |
|-----|---------------------|
| **Administradores** | Email/Contraseña + Opcional 2FA |
| **Apoderados** | Email/Contraseña o Passkey (biométrico) |
| **Estudiantes** | Huella dactilar (WebAuthn) |
| **Dispositivos** | API Key dedicada |

#### Características de Seguridad
- Tokens JWT con refresh automático
- Rate limiting en todos los endpoints
- Auditoría completa de acciones
- Cifrado de datos sensibles
- Protección CORS
- Validación de datos en múltiples capas

---

### 10. Arquitectura Multi-Tenant

Diseñado para redes de colegios y proveedores de servicios educativos:

#### Aislamiento de Datos
- Base de datos separada por establecimiento
- Configuración independiente por tenant
- Usuarios y roles por establecimiento
- Sin cruce de información entre colegios

#### Administración Centralizada
- Super Admin para gestión de la plataforma
- Provisioning automatizado de nuevos colegios
- Feature flags por establecimiento
- Planes con límites configurables

#### Planes Disponibles

| Plan | Estudiantes | Características |
|------|-------------|-----------------|
| **Standard** | Hasta 500 | Funcionalidades core |
| **Premium** | Hasta 2,000 | + Reportería avanzada |
| **Enterprise** | Ilimitado | + API, dominio personalizado |

---

## Integraciones

### APIs y Servicios Externos

| Servicio | Uso |
|----------|-----|
| **WhatsApp Business API** | Envío de mensajes y multimedia |
| **AWS SES** | Envío de emails transaccionales |
| **AWS S3** | Almacenamiento de fotos y documentos |
| **Web Push (FCM/APNS)** | Notificaciones push nativas |

### API REST Documentada

- Endpoints RESTful v1
- Autenticación OAuth2 Bearer
- Rate limiting configurable
- Documentación OpenAPI/Swagger
- Webhooks para integraciones (roadmap)

---

## Stack Tecnológico

### Backend
- **Python 3.11+** con FastAPI (async)
- **PostgreSQL** con esquemas multi-tenant
- **Redis** para colas de trabajo y caché
- **SQLAlchemy** ORM asíncrono

### Frontend
- **JavaScript** vanilla (sin dependencias pesadas)
- **Progressive Web App** (PWA)
- **Service Workers** para funcionamiento offline
- **IndexedDB** para almacenamiento local

### Infraestructura
- Contenedores Docker
- Escalamiento horizontal
- Backups automáticos
- Monitoreo y alertas

---

## Beneficios por Stakeholder

### Para el Director
- Visibilidad completa de la asistencia en tiempo real
- Reducción de tareas administrativas manuales
- Reportes para toma de decisiones
- Comunicación directa con apoderados

### Para el Inspector
- Monitoreo de alertas de no ingreso
- Gestión eficiente de ausencias
- Control de dispositivos de registro
- Auditoría de eventos

### Para el Profesor
- Toma de asistencia manual cuando sea necesario
- Vista de estudiantes de su curso
- Enrolamiento biométrico de alumnos

### Para el Apoderado
- Tranquilidad de saber cuándo llega/sale su hijo
- Justificación de ausencias desde el celular
- Sin necesidad de llamar al colegio para confirmar
- Control sobre las notificaciones que recibe

### Para el Colegio
- Modernización de procesos
- Mejora en la comunicación con familias
- Reducción de riesgos (estudiantes no localizados)
- Datos para análisis y mejora continua

---

## Diferenciadores Competitivos

| Característica | NEUVOX | Competencia |
|----------------|--------|-------------|
| Multi-canal (WhatsApp + Email + Push) | ✅ | Parcial |
| App para padres offline-first | ✅ | ❌ |
| Autenticación biométrica (WebAuthn) | ✅ | ❌ |
| Multi-tenant nativo | ✅ | ❌ |
| Alertas automáticas de no ingreso | ✅ | ❌ |
| API documentada | ✅ | Parcial |
| Captura de foto como evidencia | ✅ | ❌ |
| Preferencias de notificación por padre | ✅ | ❌ |

---

## Modelo de Comercialización

### SaaS (Software as a Service)

| Componente | Descripción |
|------------|-------------|
| **Licencia mensual** | Por establecimiento según plan |
| **Implementación** | Setup inicial, capacitación, migración |
| **Soporte** | Tickets, chat, SLA según plan |
| **Actualizaciones** | Incluidas en la suscripción |

### Servicios Adicionales

| Servicio | Descripción |
|----------|-------------|
| **Dispositivos Kiosko** | Venta o arriendo de terminales |
| **Integración personalizada** | Conexión con sistemas existentes |
| **Capacitación on-site** | Entrenamiento presencial |
| **Soporte premium** | SLA garantizado, canal dedicado |

---

## Roadmap de Producto

### Q1 2026
- [ ] Reconocimiento facial como método de registro
- [ ] Dashboard de analítica avanzada
- [ ] Integración con sistemas de gestión escolar (SIS)

### Q2 2026
- [ ] App nativa iOS/Android para padres
- [ ] Reportes personalizables
- [ ] Webhooks para integraciones

### Q3 2026
- [ ] Módulo de transporte escolar
- [ ] Geofencing para alertas de ubicación
- [ ] Integración con control de acceso vehicular

---

## Contacto

**NEUVOX Technologies**

Para más información o agendar una demostración:

- 📧 Email: comercial@neuvox.cl
- 📞 Teléfono: +56 X XXXX XXXX
- 🌐 Web: www.neuvox.cl

---

*Documento generado: Enero 2026*
*Versión: 1.0*
