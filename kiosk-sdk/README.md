# Kiosk SDK (Stub)

Módulo Kotlin que define contratos de sincronización para la app de kiosco Android.

## Contenido
- `TokenProvisionClient`: interacción con endpoints `/api/v1/tags`.
- `AttendanceSyncClient`: colas offline y reintento exponencial.
- `DeviceHeartbeatClient`: heartbeat periódico con métricas.

La implementación final deberá integrarse con WorkManager y almacenamiento local (Room/SQLDelight). Aquí sólo se dejan stubs documentados.
