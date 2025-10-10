# School Attendance – Roadmap de Maquetas

## Estado actual
- Loader corregido en las tres maquetas (web, kiosco, PWA).
- Service Workers invalidados para forzar recarga de assets actualizados.

## Próximos pasos sugeridos
1. **Verificar renderizado**
   - Correr `npx serve src/web-app -p 5173`
   - Correr `npx serve src/kiosk-app -p 5174`
   - Correr `npx serve src/teacher-pwa -p 5175`
   - Abrir cada URL en modo incógnito o haciendo *Hard Reload* para evitar caches previos.
2. **Limpiar datos persistidos**
   - Desde las DevTools del navegador, borrar `localStorage` para cada origin dedicado si los datos mock no se sincronizan al primer intento.
3. **Validar flujos clave**
   - Web App: selección de rol, navegación por tablero, filtros de eventos.
   - Kiosco: simulaciones de lectura NFC/QR, cola offline y ajustes de dispositivo.
   - PWA Profesores: log-in mock, carga de cursos, toma de asistencia y sincronización.
4. **Documentar hallazgos**
   - Registrar en este archivo cualquier bug adicional detectado o mejoras pendientes.

## Pendientes (a definir según QA)
- [ ] Ajustes adicionales tras verificación manual.
- [ ] Preparación de guías de despliegue o demo si se requieren.

## Próxima iteración sugerida
- [x] Automatizar detección de “no ingreso” vía scheduler (cron/Heroku) y exponer reportes.
- [ ] Integrar la maqueta `src/web-app` con el backend real (Hallazgo 2025-10-10):
    1. Inventariar vistas/componentes de la maqueta y mapearlos a endpoints existentes.
    2. Crear módulo JS de servicios (auth, dashboard, alertas, fotos, horarios, broadcast, preferencias) consumiendo `/api/v1/*` con manejo de errores.
    3. Sustituir el estado mock/localStorage por datos reales + sesión (JWT/cookies) y logout.
    4. Reescribir cada vista de la maqueta para usar datos remotos (tablero, reportes, alertas, evidencias, broadcast, horarios, preferencias apoderado).
    5. Eliminar vistas Jinja y ajustar router/backend a servir sólo APIs + assets; documentar despliegue e impactos.
    6. Validar accesibilidad/performance, pruebas manuales y preparar plan similar para kiosco/PWA.
- [ ] Completar broadcast con métricas/bitácora de envíos y filtros avanzados.
- [ ] Endurecer seguridad: rotación de device keys, refresh tokens persistentes y MFA para staff.
- [ ] Ajustar configuración local: soporte a base SQLite o contenedor Postgres opcional; actualmente login falla sin Postgres (observado al probar `director@example.com`).

## Roadmap backend MVP (nuevo)
1. Scaffold FastAPI + estructura modular ✅
2. Definir modelos SQLAlchemy y esquemas Pydantic ✅
3. Implementar repositorios y servicios con lógica real ✅
4. Construir endpoints REST y vistas web interactivas ✅
5. Orquestar workers RQ y jobs programados ✅
6. Integraciones externas (WhatsApp, SES, S3) con pruebas básicas ✅
7. Documentación de despliegue + guías de kiosco ✅
