@echo off
REM UNA SOLA VEZ: deja oxometro/bascula/impresora en segundo plano al encender la PC.
cd /d "%~dp0"
echo.
echo Instalando arranque automatico (sin ventanas)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
echo.
pause
