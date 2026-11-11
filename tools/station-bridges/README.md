# Bridges de estación (sin dejar ventanas abiertas)

## Una sola vez
Doble clic en **`1-instalar-arranque-automatico.bat`**

Desde entonces, al encender la PC arrancan solos:
- oxímetro → `127.0.0.1:3927`
- ECG MD100C_P (BLE) → `127.0.0.1:3928`
- impresora → `127.0.0.1:3929`
- báscula → `127.0.0.1:3930`
- baumanómetro → `127.0.0.1:3931`
- monitor Ethernet (TA/SpO₂) → `127.0.0.1:3932`
- termómetro K3 Pro (COM8) → `127.0.0.1:3933`

**Ya no hace falta** dejar abiertos los `.bat` viejos.

## Si quieres arrancarlos ya (sin reiniciar)
`iniciar-ahora-fondo.bat`

## Ver si están vivos
`ver-estado.bat`

## Puertos COM / USB (editar en `start-hidden.ps1` si cambian)
- Oxímetro: `COM4` (Silicon Labs CP210x). Si ese COM no existe, no usa el CH340 de la báscula.
- Báscula: `COM7` (CH340) @ 4800. Si ese COM no abre, prueba el CH340 que sí esté vivo.
- Baumanómetro: HID CP2110 `TU0-700X` (no es COM)
- ECG MD100C_P: Bluetooth LE, MAC `FB:1E:E4:A4:03:00` (instalar `tools\ecg-bridge\1-instalar-python-bleak.bat`)
- Termómetro K3 Pro: `COM8` @ 115200 (`pip install pyserial` en el mismo Python)

Logs: `%LOCALAPPDATA%\MaindHealth\logs`
