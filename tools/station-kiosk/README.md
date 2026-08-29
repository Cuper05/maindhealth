# MaindHealth — Kiosk en pantalla touch + Dell estación

## Qué resuelve
Evita que el paciente cierre fácil la ventana del kiosk con el touch (sin barra de dirección ni botón X típico del navegador).

## Arranque automático (recomendado)
Al encender la PC deben abrirse solas:

- **Dell:** modo estación / teleconsulta (`/estacion`)
- **ViewSonic touch:** kiosk del paciente (`/estacion/paciente`)

1. Doble clic en **`1-instalar-arranque-estacion-dell.bat`**
2. La **primera vez**, inicie sesión como **personal** en la Dell (correo y contraseña del sistema).
3. Esa sesión dura ~30 días. **No use el modo kiosk de Edge** (`--kiosk`): abre InPrivate, borra cookies y vuelve a pedir login en cada arranque.

Para quitar el arranque: `uninstall-autostart-estacion-dell.ps1`.

Acceso manual:

- Escritorio: **MaindHealth-Estacion-Dell** y **MaindHealth-Kiosko**
- O `iniciar-estacion-dell.bat` / `iniciar-kiosk-touch.bat`

## Uso diario (estación)
1. Enciende la PC (si instaló el arranque, Dell + touch entran solas).
2. Oxímetro / báscula / impresora: `tools\station-bridges\1-instalar-arranque-automatico.bat`.
3. (Opcional) **`proteger-kiosk.bat`** — bloquea Alt+F4 / F11 / tecla Windows mientras el kiosk está al frente.
4. Cerrar kiosk touch: **`cerrar-kiosk-personal.bat`**.
5. Tras un deploy: **`recargar-kiosk-touch.bat`**.

## Si pide login al encender
La Dell debe recordar la sesión. Si vuelve a pedir correo/contraseña:

1. Ejecute otra vez `1-instalar-arranque-estacion-dell.bat` (actualiza el arranque).
2. Entre **una vez** como personal en la pantalla Dell.
3. No abra `https://health.maindsteel.com.mx` en una ventana InPrivate ni con `--kiosk`.

El kiosk del paciente **no** pide credenciales de personal: debe mostrar “Estación virtual 24/7”.

## Si el kiosk no se cierra
1. `Ctrl+Shift+Esc` → Administrador de tareas.
2. Busca **Microsoft Edge** (o en Detalles: `msedge.exe`) del kiosk.
3. **Finalizar tarea**.
4. O ejecuta `cerrar-kiosk-forzado.bat` (aviso: cierra también el Edge del personal en la Dell).

## Notas
- En esta estación Windows marca la **ViewSonic touch** como monitor principal (kiosk) y la **Dell** como secundaria (teleconsulta).
- Kiosk touch: perfil `%LOCALAPPDATA%\MaindHealthKioskProfile`.
- Dell estación: perfil `%LOCALAPPDATA%\MaindHealthStationProfile` (sesión de personal separada).
- El paciente aún podría forzar reinicio con el botón físico de la PC; eso es normal. Para bloqueo total de Windows haría falta *Acceso asignado* / modo kiosk de Windows (más rígido).
