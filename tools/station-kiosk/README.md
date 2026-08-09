# MaindHealth — Kiosk en pantalla touch

## Qué resuelve
Evita que el paciente cierre fácil la ventana del kiosk con el touch (sin barra de dirección ni botón X típico del navegador).

## Uso diario (estación)
1. Enciende la PC, oxímetro (`iniciar-servicio-oximetro.bat`) y pantallas extendidas.
2. En la **Dell** (personal): abre la teleconsulta / panel médico con Edge normal.
3. Doble clic en **`iniciar-kiosk-touch.bat`** → el kiosk abre a pantalla completa en la ViewSonic.
4. (Opcional) Doble clic en **`proteger-kiosk.bat`** y deja esa ventana abierta en la Dell → bloquea Alt+F4 / F11 / tecla Windows mientras el kiosk está al frente.
5. Para cerrar el kiosk: **`cerrar-kiosk-personal.bat`** (solo personal).

## Notas
- Si la touch no es la de la derecha, edita `POS_X` en `iniciar-kiosk-touch.bat` (hoy `1920`).
- El kiosk usa un perfil aparte: `%LOCALAPPDATA%\MaindHealthKioskProfile` (no mezcla favoritos del Edge de la Dell).
- El paciente aún podría forzar reinicio con el botón físico de la PC; eso es normal. Para bloqueo total de Windows haría falta *Acceso asignado* / modo kiosk de Windows (más rígido).
