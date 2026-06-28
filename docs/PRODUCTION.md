# MaindHealth — Producción

URL actual: **https://maindhealth.vercel.app**

Base de datos: Neon (Vercel integration `neon-green-field`).

## Checklist operativo

| Ítem | Estado | Acción |
|------|--------|--------|
| App en Vercel | ✅ | — |
| Neon + seed demo | ✅ | — |
| Dominio propio | Pendiente | Ver sección Dominio |
| Stripe (pagos en línea) | Pendiente | Ver sección Stripe |
| Daily.co (teleconsulta) | Pendiente | Ver sección Daily.co |
| Hardware / ingest API | ⏸ Sin equipos | Activar cuando lleguen dispositivos |

## Dominio (ej. `health.maindsteel.com.mx`)

1. Vercel → proyecto **maindhealth** → Settings → Domains → Add.
2. En DNS de `maindsteel.com.mx`, agregar el registro que indique Vercel (CNAME o A).
3. En Vercel Environment Variables, actualizar `NEXT_PUBLIC_APP_URL` al dominio final.
4. Redeploy.

## Stripe

1. Crear cuenta en [stripe.com](https://stripe.com) (modo test primero).
2. En Vercel → **maindhealth** → Settings → Environment Variables (Production):

   | Variable | Valor |
   |----------|--------|
   | `STRIPE_SECRET_KEY` | `sk_test_...` o `sk_live_...` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` del webhook |

3. Webhook en Stripe Dashboard → Developers → Webhooks:
   - URL: `https://maindhealth.vercel.app/api/payments/webhook`
   - Eventos: `checkout.session.completed`
4. Redeploy. Probar en `/portal/pagos` con tarjeta test `4242 4242 4242 4242`.

## Daily.co

1. Crear proyecto en [daily.co](https://daily.co).
2. En Vercel (Production):

   | Variable | Valor |
   |----------|--------|
   | `VIDEO_API_KEY` | API key de Daily |
   | `DAILY_DOMAIN` | subdominio Daily (ej. `maindhealth`) |
   | `VIDEO_PROVIDER` | `daily` |

3. Redeploy. Nueva autocita **teleconsulta** creará sala automática.

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
