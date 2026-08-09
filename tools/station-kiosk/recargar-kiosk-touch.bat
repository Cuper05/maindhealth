@echo off
REM MaindHealth — Reinicia el kiosk touch con cache-bust (sin Ctrl+F5).
REM Cierra solo el perfil kiosk y lo vuelve a abrir con ?v=timestamp.

set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set PROFILE=%LOCALAPPDATA%\MaindHealthKioskProfile
set BASE_URL=https://health.maindsteel.com.mx/estacion/paciente

REM Posicion de la pantalla secundaria (touch). Mantener igual que iniciar-kiosk-touch.bat
set POS_X=1920
set POS_Y=0

if not exist %EDGE% (
  echo No se encontro Microsoft Edge.
  pause
  exit /b 1
)

echo Cerrando kiosk actual...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$profile = Join-Path $env:LOCALAPPDATA 'MaindHealthKioskProfile'; ^
   $procs = Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $profile + '*') }; ^
   if (-not $procs) { Write-Host 'No habia kiosk abierto.' } else { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('Cerrado PID ' + $_.ProcessId) } }"

REM Espera breve para que Edge suelte el perfil
timeout /t 2 /nobreak >nul

for /f %%i in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"') do set TS=%%i
set "URL=%BASE_URL%?nueva=1&v=%TS%"

echo Abriendo kiosk con URL fresca...
start "MaindHealth Kiosk" %EDGE% ^
  --user-data-dir="%PROFILE%" ^
  --kiosk "%URL%" ^
  --edge-kiosk-type=fullscreen ^
  --window-position=%POS_X%,%POS_Y% ^
  --no-first-run ^
  --disable-session-crashed-bubble ^
  --disable-features=TranslateUI,InfiniteSessionRestore ^
  --check-for-update-interval=31536000

echo Kiosk recargado en la pantalla touch.
echo URL: %URL%
exit /b 0
