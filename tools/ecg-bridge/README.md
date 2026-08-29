# Puente ECG → MaindHealth (estación)

Servicio local en `http://127.0.0.1:3928`.

## Equipo

**Lepu / Creative Medical PC-80B** (Easy ECG Monitor).

Windows lo monta como disco USB **EASY ECG**. Con el USB activo el aparato entra en modo PC y no mide.

**El cable se queda puesto.** La PC silencia el USB, el paciente mide, y luego se reactiva para leer el `.SCP`.

Una sola vez, como administrador: `tools\bp700-bridge\1-instalar-permiso-usb.bat`

## Uso en kiosko

1. Tocar **Leer electrocardiograma**
2. Dedos en las placas ~30 s; si pide guardar, aceptar
3. Tocar **Ya terminó**

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\ecg-bridge
node server.mjs
```
