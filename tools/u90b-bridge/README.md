# Tensiómetro U90B Pro (BLE)

Servicio local: `http://127.0.0.1:3931`

Sustituye al baumanómetro USB CP2110 (BP-700 / `bp700-bridge`).

## Dispositivo

- Modelo: **U90B Pro** (Urion / Alphamed)
- Bluetooth LE
- MAC de estación: `23:51:D6:CE:70:BB` (variable `U90B_ADDRESS`)
- Medición: `data[3]`=SYS, `data[4]`=DIA, `data[5]`=PULSE

## Requisitos

Mismo Python + bleak que el ECG:

```bat
tools\ecg-bridge\1-instalar-python-bleak.bat
```

Bluetooth de la PC encendido.

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\u90b-bridge
node server.mjs
```

## Uso en kiosko

1. Tocar **Leer presión ahora**
2. Colocar brazalete y pulsar **START** en el U90B Pro
3. Al ver el número (o tras ~2 s sin datos nuevos), el kiosko toma SYS/DIA/FC
4. Si ya ve el resultado, puede tocar **Ya vi el resultado**

## Rangos aceptados (sin cambio)

- Sistólica: 80–230 mmHg
- Diastólica: 40–140 mmHg
- SYS > DIA
- Pulso (si viene): 40–180 lpm
