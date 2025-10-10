# School Attendance — Control de Ingreso/Salida Escolar en Tiempo Real

School Attendance es una plataforma integral para **registrar entradas y salidas** de estudiantes en los accesos del colegio, **alertar a apoderados** por los **canales que prefieren** (WhatsApp/Email) y **dar visibilidad operativa** a Dirección e Inspectoría. Combina **kioscos de acceso** (NFC/QR), un **portal web** para gestión y reportes, y una **PWA de contingencia** para profesores que garantiza continuidad en situaciones de emergencia u offline.

---

## Beneficios clave

* **Seguridad y tranquilidad inmediata**: si un estudiante **no registra ingreso** a la hora definida, los apoderados se enteran **de inmediato**.
* **Trazabilidad completa**: todos los eventos IN/OUT quedan auditados (puerta, hora, dispositivo) y, si la familia lo autoriza, con **foto de evidencia**.
* **Ahorro operativo**: la asistencia se calcula automáticamente; no se pierde tiempo pasando lista.
* **Comunicación masiva confiable**: Dirección puede **cambiar horarios** por curso o globalmente y **notificar** a las familias en un par de clics.
* **Resiliencia**: funciona con **internet intermitente** gracias a colas locales y a la **PWA de emergencia** para profesores.

---

## Qué resuelve, para cada actor

* **Apoderados**
  Reciben notificaciones (WhatsApp/Email) de **ingreso**, **salida**, **ausencias detectadas** y **cambios de horario**. Pueden ver el estado del día e historial por hijo y definir **preferencias** (qué alertas recibir y por qué canal).
* **Dirección / Inspectoría**
  Ven un **tablero en vivo** con ingresos, salidas, atrasos y ausencias; gestionan **horarios base y excepciones**; emiten **difusiones masivas** con auditoría; revisan **reportes** y **exportan** evidencias.
* **Profesores**
  Ante contingencias (caída de un kiosco/puerta), usan la **PWA** para **marcar asistencia** por QR o en **lote**, incluso **sin internet**; la app sincroniza cuando vuelve la conectividad.
* **TI / Operaciones**
  Administran **dispositivos**, observan **colas**, batería y versión, y reciben **alertas** de salud. El sistema implementa **cifrado**, **logs de auditoría**, **retención de datos** y prácticas de **alta disponibilidad**.

---

## Componentes del sistema

1. **Kiosco de Acceso (Tablet Android)**

   * Identificación por **NFC** (sticker NTAG213 en la credencial) y/o **QR** (respaldo universal).
   * **Captura de foto** opcional como evidencia (opt-in familiar).
   * **Modo kiosco** (pantalla bloqueada), **cola local offline** e **idempotencia** por dispositivo para evitar duplicados.
   * Sincronización inteligente y **healthcheck** (batería, versión, pendientes).

2. **Portal Web Dirección/Inspectoría/Apoderados**

   * **Tablero en vivo**: ingresos del día, salidas, atrasos, “sin registro de ingreso”, fotos muestreadas.
   * **Horarios** por curso (L–V) y **excepciones** por día (alcance global o por curso) con **motivo**.
   * **Difusiones masivas** (cambios de horario, comunicados): vista previa, alcance, auditoría.
   * **Reportes** (asistencia %, atrasos, ausencias) con filtros y exportación.
   * **Preferencias de apoderado** (canal por tipo de alerta) y **opt-in foto** por alumno.
   * **Gestión de ausencias** (solicitudes, aprobación, respaldo documental).

3. **PWA de Emergencia para Profesores (iOS/Android/Web)**

   * **Escaneo QR** simulado o **marcado en lote** (Presente/Tarde/Ausente).
   * **Offline-first** (IndexedDB) con **cola** e idempotencia; resuelve **conflictos/duplicados**.
   * Se instala como app y permite **continuidad operativa** si un kiosco falla.

4. **Backend y servicios**

   * **API** segura (Python/FastAPI), **PostgreSQL** (datos), **Redis/Colas** (procesamiento), **S3** (fotos cifradas).
   * **Notificaciones**:

     * **WhatsApp** vía **Meta WhatsApp Cloud API** (plantillas transaccionales).
     * **Email** vía **Amazon SES**.
   * **Reglas**: cálculo de **horario efectivo** (base + excepción) por curso/fecha y disparo de **“no ingresó antes de X”**.
   * **Auditoría y privacidad**: cifrado en tránsito/descanso, acceso por roles y **retención** de fotos (p. ej., 60 días).

---

## Cómo funciona (visión de punta a punta)

1. **Ingreso**

   * El estudiante **acerca su tarjeta NFC** o muestra **QR** en el kiosco.
   * El sistema resuelve el alumno y **confirma** IN (o sugiere OUT si ya estaba dentro).
   * Si corresponde, captura **foto** como evidencia.
   * El evento queda disponible en el **tablero** y, según preferencias, se envía **notificación** a los apoderados.

2. **Detección temprana de inasistencia**

   * A la **hora de ingreso efectiva** por curso (considerando **excepciones**), el sistema verifica quién no registró IN y **avisa** a apoderados.
   * Dirección obtiene un **listado accionable** para seguimiento.

3. **Salida**

   * Al registrar OUT, los apoderados reciben la **hora exacta** y **puerta**, mejorando la coordinación de retiro.

4. **Cambios de horario**

   * El director crea una **excepción** (global o por curso) con **motivo** y, si lo elige, **notifica** masivamente a todas las familias afectadas.
   * Todo queda **auditado** (quién, cuándo, a quiénes).

5. **Contingencia**

   * Si una puerta o la red falla, la **PWA** permite **continuar** el registro; los eventos **se sincronizan** al restablecerse.

---

## Credenciales y seguridad

* **NFC (sticker)**: NTAG213 autoadhesivo, programado en **solo lectura** con un `tag_token` aleatorio (NDEF URI). El backend mantiene el mapping `tag_token → alumno`.
* **QR**: token firmado o efímero, ideal para wallet/credencial digital (y respaldo universal).
* **Mitigación de fraude**: evidencia fotográfica (opt-in), revisión muestreada por Inspectoría, revocación ágil de tokens.
* **Privacidad**:

  * **Fotos cifradas** en S3, acceso por rol y **retención** configurable (p. ej., 60 días).
  * **Consentimientos** por familia (opt-in foto).
  * **Auditoría** de accesos y lecturas.
* **Disponibilidad**: colas locales y reintentos; diseño **offline-first** en kiosco y PWA.

---

## Roles y permisos

* **Apoderado**: ver estado/historial, gestionar preferencias (canales por tipo de aviso) y presentar **solicitudes de ausencia**.
* **Profesor**: (en contingencia) marcar asistencia en aula, ver cola local e historial del curso.
* **Inspector**: tablero en vivo, reportes, revisión de evidencia, gestión operativa de puertas.
* **Director**: todo lo anterior + **excepciones de horario**, **difusiones masivas**, configuración global.
* **Administrador TI**: gestión de dispositivos, integraciones, auditoría, políticas de retención.

---

## Integraciones

* **WhatsApp (Meta WhatsApp Cloud API)**: envío de plantillas transaccionales aprobadas (ingreso/salida/ausencia/cambio horario). Gestión de calidad y opt-in.
* **Email (Amazon SES)**: respaldo y canal alternativo.
* **Almacenamiento**: S3 (o compatible) con cifrado y políticas de ciclo de vida para borrado automático de fotos.
* **Autenticación**:

  * Apoderados: **magic link** por WhatsApp/Email (sin contraseñas).
  * Staff: usuario corporativo con **2FA** o SSO del colegio.

---

## Modelo de datos (resumen)

* **Student**(id, nombre, curso, estado, preferencias de foto)
* **Guardian**(id, nombre, contactos verificados, preferencias de notificación)
* **Course**(id, nombre, nivel)
* **Enrollment**(student_id, course_id, año)
* **Tag**(id, tag_token_hash, student_id, estado, revocado_en)
* **AttendanceEvent**(id, student_id, tipo: IN/OUT, gate_id, ts, device_id, photo_ref?)
* **Schedule**(course_id, weekday, in_time, out_time)
* **ScheduleException**(scope: GLOBAL|COURSE, course_id?, date, in_time?, out_time?, reason)
* **AbsenceRequest**(student_id, tipo, rango, adjunto?, estado, aprobador, timestamps)
* **Notification**(event_id?, guardian_id, canal, plantilla, payload, estado, reintentos)
* **Device**(gate_id, device_id, versión, last_sync, pending_count, batería, estado)
* **AuditLog**(actor, rol, acción, entidad, id, ts, ip)

---

## Operación y soporte

* **SLA/Objetivos**: notificación **< 60 s** mediana tras el evento; retardo tolerante con colas si hay congestión.
* **Monitoreo**: métricas de envíos, latencias, colas por puerta, tasa de errores, batería, salud de dispositivos.
* **Respaldo**: backups programados de DB; políticas de **retención** (fotos) y **borrado** automático.
* **Escalabilidad**: colas y workers horizontales, procesamiento por lotes para difusiones, particionado por sede.

---

## Guía rápida para el colegio

1. **Instalar kioscos** en accesos (tablets con soporte y energía).
2. **Emitir credenciales** (stickers NFC o QR), con **proceso de provisión** y revocación.
3. **Cargar alumnos/apoderados** y **definir horarios** por curso.
4. **Capacitar** a portería y profesores (uso de kiosco y PWA).
5. **Pilotear** en una puerta/curso; luego escalar a todo el colegio.

---

## Preguntas frecuentes

* **¿Qué pasa si hay dos puertas?**
  Se instalan 2 kioscos; ambos registran IN/OUT. La plataforma consolida por alumno y **evita duplicados**.

* **¿Y si un estudiante olvida la tarjeta?**
  Puede usar **QR** (credencial digital). Si no, el personal puede **marcar manualmente** con evidencia.

* **¿Puedo usar el NFC del celular del apoderado?**
  **Android** permite HCE (emulación) en ciertos escenarios; **iOS** es más restringido. El sistema soporta **QR/Wallet** como solución universal.

* **¿Las fotos son obligatorias?**
  No. Son **opt-in** por familia y solo para trazabilidad con **retención corta**.

* **¿Se pueden personalizar los mensajes?**
  Sí, con **plantillas** (variables por curso/fecha/motivo) y **vista previa** antes de enviar.

---

## Resumen

School Attendance convierte el acceso al colegio en un **punto de control seguro**, genera **datos confiables** de asistencia, y **comunica** lo importante a quienes más lo necesitan —los apoderados—, **a tiempo**. Es simple de operar, robusto ante fallas y respetuoso de la privacidad.

Si quieres una demo o guía de despliegue para tu establecimiento, podemos ayudarte a preparar el piloto en **1–2 semanas** con hardware básico y tu listado actual de alumnos.
