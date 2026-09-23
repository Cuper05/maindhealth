# Bridges de estación (sin dejar ventanas abiertas)

## Una sola vez
Doble clic en **`1-instalar-arranque-automatico.bat`**

Desde entonces, al encender la PC arrancan solos:
- oxímetro → `127.0.0.1:3927`
- ECG PC-80B → `127.0.0.1:3928`
- impresora → `127.0.0.1:3929`
- báscula → `127.0.0.1:3930`
- baumanómetro → `127.0.0.1:3931`
- monitor Ethernet (TA/SpO₂) → `127.0.0.1:3932`
- termómetro Beurer FT95 → `127.0.0.1:3933`

**Ya no hace falta** dejar abiertos los `.bat` viejos.

## Si quieres arrancarlos ya (sin reiniciar)
`iniciar-ahora-fondo.bat`

## Ver si están vivos
`ver-estado.bat`

## Puertos COM / USB (editar en `start-hidden.ps1` si cambian)
- Oxímetro: `COM4` (Silicon Labs CP210x). Si ese COM no existe, no usa el CH340 de la báscula.
- Báscula: `COM7` (CH340) @ 4800. Si ese COM no abre, prueba el CH340 que sí esté vivo.
- Baumanómetro: HID CP2110 `TU0-700X` (no es COM)
- ECG PC-80B: disco USB `EASY ECG`

Logs: `%LOCALAPPDATA%\MaindHealth\logs`
