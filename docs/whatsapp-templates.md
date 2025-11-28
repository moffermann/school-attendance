# WhatsApp Business Templates Configuration

Este documento describe los templates de WhatsApp necesarios para el sistema de notificaciones de asistencia escolar.

## Requisitos Previos

1. Cuenta de WhatsApp Business API configurada
2. Número de teléfono verificado en Meta Business Suite
3. Acceso a Meta Business Manager para crear templates

## Templates Requeridos

### 1. INGRESO_OK - Notificación de Ingreso

**Nombre del template:** `ingreso_ok`
**Categoría:** UTILITY
**Idioma:** es (Español)

**Contenido del mensaje:**
```
Ingreso registrado: {{1}} ingresó al colegio el {{2}} a las {{3}}.
```

**Parámetros:**
| # | Variable | Descripción | Ejemplo |
|---|----------|-------------|---------|
| 1 | student_name | Nombre del estudiante | "María González" |
| 2 | date | Fecha del ingreso | "15/03/2024" |
| 3 | time | Hora del ingreso | "08:30" |

**Ejemplo de mensaje final:**
> Ingreso registrado: María González ingresó al colegio el 15/03/2024 a las 08:30.

---

### 2. SALIDA_OK - Notificación de Salida

**Nombre del template:** `salida_ok`
**Categoría:** UTILITY
**Idioma:** es (Español)

**Contenido del mensaje:**
```
Salida registrada: {{1}} salió del colegio el {{2}} a las {{3}}.
```

**Parámetros:**
| # | Variable | Descripción | Ejemplo |
|---|----------|-------------|---------|
| 1 | student_name | Nombre del estudiante | "María González" |
| 2 | date | Fecha de salida | "15/03/2024" |
| 3 | time | Hora de salida | "13:30" |

---

### 3. NO_INGRESO_UMBRAL - Alerta de No Ingreso

**Nombre del template:** `no_ingreso_umbral`
**Categoría:** UTILITY
**Idioma:** es (Español)

**Contenido del mensaje:**
```
Alerta: {{1}} no ha registrado ingreso al colegio hoy {{2}}. Por favor verifique su situación.
```

**Parámetros:**
| # | Variable | Descripción | Ejemplo |
|---|----------|-------------|---------|
| 1 | student_name | Nombre del estudiante | "María González" |
| 2 | date | Fecha actual | "15/03/2024" |

---

### 4. CAMBIO_HORARIO - Notificación de Cambio de Horario

**Nombre del template:** `cambio_horario`
**Categoría:** UTILITY
**Idioma:** es (Español)

**Contenido del mensaje:**
```
Aviso: Se ha modificado el horario de {{1}} para el {{2}}. Nuevo horario de entrada: {{3}}. Por favor tome nota.
```

**Parámetros:**
| # | Variable | Descripción | Ejemplo |
|---|----------|-------------|---------|
| 1 | student_name | Nombre del estudiante | "María González" |
| 2 | date | Fecha del cambio | "16/03/2024" |
| 3 | new_time | Nueva hora de entrada | "09:00" |

---

## Configuración en Meta Business Suite

### Paso 1: Acceder al Administrador de WhatsApp

1. Ir a [Meta Business Suite](https://business.facebook.com/)
2. Seleccionar la cuenta de negocio
3. Ir a WhatsApp > Configuración > Message Templates

### Paso 2: Crear Template

1. Click en "Create Template"
2. Seleccionar categoría: **UTILITY**
3. Nombre: usar nombres indicados arriba (ej: `ingreso_ok`)
4. Idioma: Español (es)
5. Agregar el contenido con variables `{{1}}`, `{{2}}`, etc.

### Paso 3: Enviar para Revisión

1. Revisar que el contenido cumple las políticas de Meta
2. Enviar para aprobación
3. Esperar aprobación (usualmente 24-48 horas)

---

## Variables de Entorno Requeridas

```bash
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
ENABLE_REAL_NOTIFICATIONS=true  # false para modo desarrollo
```

---

## Mensajes con Imagen (Fotos de Evidencia)

Para los mensajes de INGRESO_OK y SALIDA_OK con foto, el sistema NO usa templates, sino mensajes de tipo `image` con caption:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+56912345678",
  "type": "image",
  "image": {
    "link": "https://s3.amazonaws.com/bucket/photo.jpg",
    "caption": "Ingreso registrado: María González ingresó al colegio el 15/03/2024 a las 08:30."
  }
}
```

**Importante:** Las URLs de imágenes deben ser públicamente accesibles. El sistema genera URLs presigned de S3 con expiración de 7 días.

---

## Troubleshooting

### Template Rechazado
- Verificar que no contiene contenido promocional
- Asegurar que el mensaje es transaccional/informativo
- Revisar que las variables están correctamente formateadas

### Mensajes No Llegan
- Verificar que el número del destinatario está en formato internacional
- Confirmar que `ENABLE_REAL_NOTIFICATIONS=true`
- Revisar logs del worker en Redis Queue

### Error de Foto No Accesible
- La URL de S3 debe ser pública o usar presigned URL
- Verificar que la URL no ha expirado
- Confirmar que el bucket permite acceso público

---

## Referencias

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
