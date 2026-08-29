# Puente ECG → MaindHealth (estación)

Servicio local en `http://127.0.0.1:3928`.

## Equipo

**Lepu / Creative Medical PC-80B** (Easy ECG Monitor).

Windows lo monta como disco USB **EASY ECG** (`D:`). El bridge lee el `.SCP` más reciente y extrae FC + interpretación.

## Uso en kiosko

1. El paciente mide ~30 s con los dedos en las placas.
2. Si el aparato pide guardar, aceptar.
3. USB conectado a la PC.
4. Tocar **Leer electrocardiograma**.

Si con el USB puesto el aparato no inicia la medición: desconectar, medir, reconectar y leer.

## Arranque

Va en `tools\station-bridges` (fondo). Manual:

```bat
cd tools\ecg-bridge
node server.mjs
```
