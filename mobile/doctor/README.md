# MaindHealth — App móvil de médicos

App **Expo (React Native)** para que el médico reciba una alerta fuerte (sonido + vibración) cuando la estación IA escala a teleconsulta, y abra la misma sala Daily / consulta web con un toque.

## Requisitos

- Node 20+
- Cuenta [Expo](https://expo.dev) (para push en dispositivo físico)
- Backend MaindHealth desplegado (`EXPO_PUBLIC_API_URL`)
- Tras cambios de schema en el servidor: `npm run db:push` (tabla `push_tokens`)

## Instalación

```bash
cd mobile/doctor
cp .env.example .env
# Edita .env con tu API y projectId de Expo
npm install
npx expo start
```

Escanea el QR con **Expo Go** (Android) o la cámara (iOS), o genera un build de desarrollo (recomendado para push fiable).

### Variables de entorno

| Variable | Ejemplo | Uso |
|----------|---------|-----|
| `EXPO_PUBLIC_API_URL` | `https://health.maindsteel.com.mx` | Base del API Next.js |
| `EXPO_PUBLIC_PROJECT_ID` | UUID de EAS | Obligatorio para `getExpoPushTokenAsync` en builds/EAS |

Demo médico (seed): `doctor@maindhealth.local` / `admin123`

## Flujo

1. Login → `POST /api/mobile/auth/login` → token Bearer (30 días)
2. Home registra el token Expo → `POST /api/mobile/push-token`
3. Al escalar en estación, `notifyDoctorsStationTeleconsulta` escribe la notificación web **y** envía push Expo (canal Android `teleconsulta`, prioridad alta)
4. En primer plano: vibración + sonido; en segundo plano: notificación del SO
5. Tap → pantalla `call` (WebView) con `meetingUrl` Daily o `/consultas/cita/[id]#video`

## Push / EAS (lo que falta en tu cuenta)

Push remoto **no funciona solo con el código**: necesitas un proyecto Expo.

```bash
npm i -g eas-cli
eas login
cd mobile/doctor
eas init          # crea projectId → cópialo a EXPO_PUBLIC_PROJECT_ID
eas build:configure
```

- **Android**: canal `teleconsulta` con importancia máxima (casi alarma). Con Expo Go el sonido/vibración funciona; producción ideal = build EAS.
- **iOS**: requiere Apple Developer + certificados push (EAS los gestiona en `eas credentials`).
- Credenciales FCM (Android) / APNs (iOS) se configuran en el dashboard de Expo/EAS.

Sin `EXPO_PUBLIC_PROJECT_ID` válido, el login y la lista de teleconsultas funcionan, pero el registro de push fallará o no entregará mensajes.

## API backend (ya en el monorepo)

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/mobile/auth/login` | — |
| POST | `/api/mobile/push-token` | Bearer |
| GET | `/api/mobile/teleconsultas` | Bearer |

La tabla Drizzle `push_tokens` (`userId`, `token`, `platform`, `updatedAt`, unique `token`) se aplica con `npm run db:push` en la raíz del repo.

## Notas

- No sustituye el EHR web; MVP = login + cola de teleconsultas + alerta + videollamada.
- El flujo web de estación no se modifica más allá del envío adicional de push.
