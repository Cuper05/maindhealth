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

1. Pulsar el **botón de encendido** del baumanómetro
2. Tocar el botón verde **Leer presión ahora** en el kiosko
3. Introducir el brazo en el **túnel**, a la altura del corazón
4. Pulsar otra vez el **botón de encendido** para iniciar la medición
5. Esperar el resultado; retirar el brazo
6. Pulsar el **botón de encendido** otra vez para apagar

## Rangos aceptados (sin cambio)

- Sistólica: 80–230 mmHg
- Diastólica: 40–140 mmHg
- SYS > DIA
- Pulso (si viene): 40–180 lpm
