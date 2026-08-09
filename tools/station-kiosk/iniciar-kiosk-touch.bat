@echo off
REM MaindHealth — Kiosk paciente en pantalla touch (ViewSonic)
REM Modo kiosk de Edge: sin barra de direcciones ni botones de cerrar faciles.

set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set PROFILE=%LOCALAPPDATA%\MaindHealthKioskProfile
set URL=https://health.maindsteel.com.mx/estacion/paciente?nueva=1

REM Posicion de la pantalla secundaria (touch). Si se mueve el monitor, ajusta X.
REM Dell principal = 0,0 | ViewSonic = 1920,0 (segun configuracion actual)
set POS_X=1920
set POS_Y=0

if not exist %EDGE% (
  echo No se encontro Microsoft Edge.
  pause
  exit /b 1
)

REM Cierra una instancia previa del perfil kiosk (evita ventanas sueltas)
taskkill /F /FI "WINDOWTITLE eq MaindHealth Kiosk*" >nul 2>&1

start "MaindHealth Kiosk" %EDGE% ^
  --user-data-dir="%PROFILE%" ^
  --kiosk "%URL%" ^
  --edge-kiosk-type=fullscreen ^
  --window-position=%POS_X%,%POS_Y% ^
  --no-first-run ^
  --disable-session-crashed-bubble ^
  --disable-features=TranslateUI,InfiniteSessionRestore ^
  --check-for-update-interval=31536000

echo Kiosk iniciado en la pantalla touch.
echo El personal puede cerrarlo con: cerrar-kiosk-personal.bat
exit /b 0
