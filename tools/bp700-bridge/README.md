# Baumanómetro USB (CP2110 / BP-700)

Servicio local: `http://127.0.0.1:3931`

Windows lo ve como **Silicon Labs CP2110** (HID), serie **TU0-700X**. No aparece como COM.

## Importante

El aparato entra en modo PC si Windows tiene el USB activo, y entonces no enciende. **El cable se queda puesto.** La PC silencia el USB, el paciente mide, y luego se reactiva para leer.

Una sola vez, como administrador: `1-instalar-permiso-usb.bat`

## Uso en kiosko

1. Tocar **Leer presión ahora**
2. Colocar brazalete y pulsar inicio en el aparato
3. Al ver el número, tocar **Ya vi el resultado**

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\bp700-bridge
node server.mjs
```
