# MaindHealth — App móvil de médicos

App **nativa Expo (React Native)** para que el médico reciba alerta (sonido + vibración) cuando la estación escala a teleconsulta, y abra la sala Daily / consulta con un toque.

## Instalación del producto (iPhone / Android)

**Camino oficial:** build EAS instalable.  
Sigue **[INSTALAR-APP-REAL.md](./INSTALAR-APP-REAL.md)** — pasos en español con tu cuenta Expo/Apple.

Expo Go **no** es el método de entrega del producto.

## Requisitos

- Node 20+
- Cuenta [Expo](https://expo.dev) + `eas-cli`
- Apple Developer (iPhone) / dispositivo Android para APK preview
- Backend MaindHealth (`EXPO_PUBLIC_API_URL`)
- Tras schema push en servidor: `npm run db:push` (tabla `push_tokens`)

## Variables de entorno

Copia `.env.example` → `.env`:

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_API_URL` | Base del API Next.js |
| `EXPO_PUBLIC_PROJECT_ID` | UUID de `eas init` — **obligatorio para push** (no inventar) |

Demo médico (seed): `doctor@maindhealth.local` / `admin123`

## Identificadores

- iOS: `mx.com.maindsteel.maindhealth.doctor`
- Android: `mx.com.maindsteel.maindhealth.doctor`
- Perfiles EAS: `development` / `preview` / `production` en `eas.json`

## Flujo

1. Login → `POST /api/mobile/auth/login` → Bearer (30 días)
2. Home registra token Expo → `POST /api/mobile/push-token`
3. Escalación en estación → push Expo (canal Android `teleconsulta`)
4. Tap **Unirse a videollamada** → pantalla `call` (Daily + signos/síntomas)
5. Tap **Crear / emitir receta** (o pestaña en la llamada) → puente de sesión web → `/consultas/cita/[id]` para guardar consulta, emitir y firmar receta

## API backend

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/mobile/auth/login` | — |
| POST | `/api/mobile/push-token` | Bearer |
| GET | `/api/mobile/teleconsultas` | Bearer |
| GET | `/api/mobile/teleconsultas/[appointmentId]` | Bearer |
| GET | `/api/mobile/session/bridge?token=&appointmentId=` | token en query (WebView) |
