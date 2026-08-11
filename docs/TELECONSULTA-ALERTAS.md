# Teleconsulta — alertas urgentes (voz / SMS / WhatsApp)

Cuando la IA del kiosk escala a teleconsulta, además de la notificación in-app y el auto-open en la Dell de estación, MaindHealth alerta médicos remotos en cola:

1. Llamada de voz (Twilio Voice) — mensaje de urgencia; marque **1** para reenviar el enlace.
2. SMS con enlace opaco `https://health.maindsteel.com.mx/t/{token}`
3. WhatsApp con el mismo enlace (Twilio WhatsApp).

Si el médico no abre el enlace en `TELECONSULTA_ESCALATE_SECONDS` (default **45**), se escala al siguiente médico de la cola (misma tríada).

El enlace abre video inmediato en el navegador (Daily), sin login ni app nativa.

## Variables de entorno (Vercel)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `TWILIO_ACCOUNT_SID` | Sí | Account SID de Twilio |
| `TWILIO_AUTH_TOKEN` | Sí | Auth Token |
| `TWILIO_FROM_NUMBER` | Sí | Número de voz/SMS en E.164 (`+1…` o número comprado) |
| `TWILIO_WHATSAPP_FROM` | Sí* | Remitente WhatsApp, ej. `whatsapp:+14155238886` (sandbox) o número WhatsApp Business |
| `TELECONSULTA_ESCALATE_SECONDS` | No | Segundos antes de pasar al siguiente médico (15–600, default 45) |
| `APP_BASE_URL` o `NEXT_PUBLIC_APP_URL` | Sí | Base pública, ej. `https://health.maindsteel.com.mx` |
| `CRON_SECRET` | Sí (prod) | Bearer para `/api/cron/teleconsulta-escalate` (Vercel Cron lo envía solo) |
| `VIDEO_API_KEY` | Sí | Daily.co — salas y tokens de join |

\* Sin `TWILIO_WHATSAPP_FROM` se intenta `whatsapp:{TWILIO_FROM_NUMBER}`.

### Twilio WhatsApp (México / sandbox)

1. En [Twilio Console](https://console.twilio.com) → Messaging → Try WhatsApp, active el sandbox.
2. Cada médico de prueba debe enviar el código de join al número sandbox (ej. `join <palabra>`).
3. Use `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (o el número que muestre Twilio).
4. En producción, solicite un WhatsApp Business Sender aprobado en Twilio.

### Cron

`vercel.json` programa `GET /api/cron/teleconsulta-escalate` cada minuto. Protegido con `Authorization: Bearer $CRON_SECRET`. También hay un tick con `after()` al iniciar la escalación (mejor latencia ~45s).

## Cargar teléfonos de médicos

1. Inicie sesión como **admin**.
2. Vaya a **Configuración** (`/configuracion`).
3. En **Contacto urgencias teleconsulta**, capture el teléfono (10 dígitos MX o `+52…`) y marque **Disponible teleconsulta**.
4. Guardar. Solo médicos activos, con teléfono y disponibles entran en la cola.

Orden de cola: médico asignado a la cita → médico responsable de estación → resto (alfabético).

## Probar con un solo número

1. Configure Twilio + `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` en Vercel y redeploy.
2. En Configuración, ponga **su** celular en un médico demo y desmarque disponibilidad en los demás (o déjelos sin teléfono).
3. En el kiosk, complete un flujo que escale a teleconsulta (banderas rojas / fuera de protocolo).
4. Debe recibir: llamada + SMS + WhatsApp con `/t/…`.
5. Abra el enlace en el móvil → permita cámara/mic → video Daily.
6. La escalación queda en estado `joined` y no llama a más médicos.

Webhooks públicos (no requieren sesión):

- `POST /api/alerts/twilio/voice`
- `POST /api/alerts/twilio/gather`

## Tablas

- `teleconsulta_join_tokens` — tokens opacos del deep link
- `teleconsulta_escalations` — pipeline por cita (`next_action_at`, cola JSON)
- `teleconsulta_alert_attempts` — intento por médico (SIDs Twilio, status)
- `users.teleconsulta_available` — opt-in a la cola
- `users.phone` — destino de alertas
