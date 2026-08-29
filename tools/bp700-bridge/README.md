# Baumanómetro USB (CP2110 / BP-700)

Servicio local: `http://127.0.0.1:3931`

Windows lo ve como **Silicon Labs CP2110** (HID), serie **TU0-700X**. No aparece como COM.

## Importante

El aparato **no enciende ni mide con el USB conectado** (modo PC). Flujo:

1. Tocar **Leer presión ahora**
2. **Desconectar** el USB
3. Medir en el aparato
4. Al ver el resultado, **reconectar** el USB
5. El kiosko lee solo

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
| GET | `/health` | `{ ok, plugged, serial }` |
| GET | `/progress` | `{ phase, message }` |
| POST | `/read` | Espera desconectar/reconectar y devuelve `{ ok, systolicPressure, diastolicPressure, heartRate }` |
