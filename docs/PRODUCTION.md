# MaindHealth — Producción

URL actual: **https://maindhealth.vercel.app**

Base de datos: Neon (Vercel integration `neon-green-field`).

## Checklist operativo

| Ítem | Estado | Acción |
|------|--------|--------|
| App en Vercel | ✅ | — |
| Neon + seed demo | ✅ | — |
| Dominio propio | Pendiente | Ver sección Dominio |
| Stripe (pagos en línea) | ✅ Test keys + webhook | Completar onboarding Stripe (charges_enabled) antes de live |
| Daily.co (teleconsulta) | Pendiente | Ver sección Daily.co |
| Hardware / ingest API | ⏸ Sin equipos | Activar cuando lleguen dispositivos |

## Dominio (ej. `health.maindsteel.com.mx`)

1. Vercel → proyecto **maindhealth** → Settings → Domains → Add.
2. En DNS de `maindsteel.com.mx`, agregar el registro que indique Vercel (CNAME o A).
3. En Vercel Environment Variables, actualizar `NEXT_PUBLIC_APP_URL` al dominio final.
4. Redeploy.

## Stripe

> **Estado actual:** ✅ Test mode configurado en producción (`health.maindsteel.com.mx`).
> Diagnóstico: [`/api/payments/status`](https://health.maindsteel.com.mx/api/payments/status) → `ok: true`.
> Webhook: `https://health.maindsteel.com.mx/api/payments/webhook`
> Antes de **live**: completar onboarding Stripe (hoy `charges_enabled=false`) y cambiar a `sk_live_…`.

### Configurar (local primero)

```powershell
# Interactivo: pega sk_test_… y la URL pública
.\scripts\setup-stripe.ps1
```

O a mano en `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://health.maindsteel.com.mx
```

Diagnóstico (sin secretos): `GET /api/payments/status`

### Stripe Dashboard (modo Test)

1. [API keys](https://dashboard.stripe.com/test/apikeys) → Secret key → `STRIPE_SECRET_KEY`
2. [Webhooks](https://dashboard.stripe.com/test/webhooks) → Add endpoint:
   - URL: `https://<tu-dominio>/api/payments/webhook`
   - Evento: `checkout.session.completed`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`
3. En Vercel → Environment Variables (Production) las mismas tres variables.
4. Redeploy. Probar:
   - `GET /api/payments/status` → `ok: true`, `mode: "test"`
   - Estación: `/estacion/paciente` → **Pagar con tarjeta (Stripe)**
   - Tarjeta: `4242 4242 4242 4242`, fecha futura, CVC `123`
5. El webhook y el retorno a `/estacion/paciente?stripe=success&session_id=…` aprueban la orden.
## Daily.co

1. Crear proyecto en [daily.co](https://daily.co).
2. En Vercel (Production):

   | Variable | Valor |
   |----------|--------|
   | `VIDEO_API_KEY` | API key de Daily |
   | `DAILY_DOMAIN` | subdominio Daily (ej. `maindhealth`) |
   | `VIDEO_PROVIDER` | `daily` |

3. Redeploy. Nueva autocita **teleconsulta** creará sala automática.

## Alertas urgentes teleconsulta (Twilio)

Llamada + SMS + WhatsApp a médicos en cola cuando el kiosk escala. Guía completa: [`docs/TELECONSULTA-ALERTAS.md`](./TELECONSULTA-ALERTAS.md).

Variables mínimas: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`, `CRON_SECRET`, `APP_BASE_URL` o `NEXT_PUBLIC_APP_URL`. Teléfonos de médicos en **Configuración**.

## Correo de recetas (kiosco)

Al emitir receta en estación se envía el PDF al correo del paciente (obligatorio en el alta).

| Variable | Valor |
|----------|--------|
| `RESEND_API_KEY` | API key de [Resend](https://resend.com) |
| `EMAIL_FROM` | Remitente verificado, ej. `MaindHealth <noreply@tu-dominio.com>` |

## Hardware (cuando tengas equipos)

No bloquea el resto del sistema. Hoy puedes:

- Captura manual: `/triage`, `/dispositivos`
- Alertas clínicas desde signos vitales manuales

Cuando lleguen equipos:

1. Agregar `DEVICE_INGEST_API_KEY` en Vercel (valor aleatorio largo).
2. Configurar el gateway/equipo para `POST`:

   ```
   POST https://maindhealth.vercel.app/api/device-readings/ingest
   Header: x-api-key: <DEVICE_INGEST_API_KEY>
   Body: JSON según schema en src/lib/validators/phase4.ts
   ```

3. Fase 5 (futuro): MQTT/BLE en tiempo real — ver `docs/ROADMAP.md`.

## Usuarios demo (cambiar antes de go-live real)

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@maindhealth.local | admin123 |
| Médico | doctor@maindhealth.local | admin123 |
| Paciente | paciente@maindhealth.local | admin123 |

## Comandos útiles

```bash
# Schema en Neon (usa .env.local de Vercel)
npm run db:push
npm run db:seed

# Deploy
npx vercel deploy --prod
```

## Protocolo de estación (Fase 5)

Flujo guiado en **`/estacion/flujo`**:

1. Bienvenida  
2. Paciente nuevo o recurrente  
3. Captura / confirmación de datos  
4. Formulario clínico inicial (antecedentes estructurados)  
5. Consentimiento informado  
6. Instrucciones para toma de signos vitales → triage  
7. Sala de espera de teleconsulta  

Sin completar pasos 1–5 (intake en BD), no hay triage ni consulta.
