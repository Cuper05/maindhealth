# Baumanómetro USB (CP2110 / BP-700)

Servicio local: `http://127.0.0.1:3931`

Windows lo ve como **Silicon Labs CP2110** (HID), serie **TU0-700X**. No aparece como COM.

## Arranque

```bat
cd tools\bp700-bridge
npm install
node server.mjs
```

O con el paquete de estación: `tools\station-bridges\iniciar-ahora-fondo.bat`

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | `{ ok, serial }` |
| POST | `/read` | `{ ok, systolicPressure, diastolicPressure, heartRate }` |

En el kiosko: paso **Presión arterial** → **Leer presión ahora**.
