@echo off
REM MaindHealth - Kiosk paciente en pantalla touch (ViewSonic)
REM Coloca la ventana en el monitor secundario (detectado), no en la Dell.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-station-windows.ps1" -Role kiosk
echo Kiosk iniciado en la pantalla touch.
echo Impresion: deje corriendo iniciar-servicio-impresora.bat (tools\station-print-bridge).
echo El personal puede cerrarlo con: cerrar-kiosk-personal.bat
exit /b 0
