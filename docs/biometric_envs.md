# Configuración de Variables WebAuthn para Biometría

## Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# WebAuthn / Biometric Authentication
WEBAUTHN_RP_ID=school-attendance.dev.gocode.cl
WEBAUTHN_RP_NAME=Sistema Asistencia Escolar
WEBAUTHN_RP_ORIGIN=https://school-attendance.dev.gocode.cl
WEBAUTHN_TIMEOUT_MS=60000
```

## Descripción de Variables

| Variable | Descripción |
|----------|-------------|
| `WEBAUTHN_RP_ID` | Dominio donde se registran las credenciales. Las credenciales **solo funcionan** en este dominio exacto. |
| `WEBAUTHN_RP_NAME` | Nombre que ve el usuario en el prompt del navegador al registrar/autenticar biometría. |
| `WEBAUTHN_RP_ORIGIN` | URL completa del origen (protocolo + dominio). Debe incluir `https://` en producción. |
| `WEBAUTHN_TIMEOUT_MS` | Tiempo máximo en milisegundos para completar registro o autenticación. Default: 60000 (60 segundos). |

## Ejemplos por Ambiente

### Desarrollo Local

```bash
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Sistema Asistencia Escolar
WEBAUTHN_RP_ORIGIN=http://localhost:8000
WEBAUTHN_TIMEOUT_MS=60000
```

### Producción (GoCode)

```bash
WEBAUTHN_RP_ID=school-attendance.dev.gocode.cl
WEBAUTHN_RP_NAME=Sistema Asistencia Escolar
WEBAUTHN_RP_ORIGIN=https://school-attendance.dev.gocode.cl
WEBAUTHN_TIMEOUT_MS=60000
```

### Producción (Dominio Propio)

```bash
WEBAUTHN_RP_ID=asistencia.micolegio.cl
WEBAUTHN_RP_NAME=Colegio Mi Colegio
WEBAUTHN_RP_ORIGIN=https://asistencia.micolegio.cl
WEBAUTHN_TIMEOUT_MS=60000
```

## Consideraciones Importantes

1. **HTTPS obligatorio en producción**: WebAuthn requiere contexto seguro. Solo `localhost` puede usar HTTP.

2. **Dominio exacto**: El `RP_ID` debe coincidir exactamente con el dominio donde corre la aplicación. Las credenciales registradas en un dominio **no funcionarán** en otro.

3. **Subdominios**: Si usas `RP_ID=example.com`, las credenciales funcionarán en `example.com` y sus subdominios (`kiosk.example.com`, `admin.example.com`). Pero si usas `RP_ID=kiosk.example.com`, solo funcionarán en ese subdominio específico.

4. **Migración de dominio**: Si cambias de dominio, todas las credenciales biométricas registradas dejarán de funcionar. Los estudiantes deberán re-registrar sus huellas.

5. **Timeout**: 60 segundos es suficiente para la mayoría de casos. Aumentar si los usuarios tienen dificultades para completar el proceso.
