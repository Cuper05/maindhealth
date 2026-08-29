@echo off
REM MaindHealth - Pantalla Dell: modo estacion / teleconsulta automatica
REM NO usa --kiosk de Edge: ese modo es InPrivate y pide login en cada arranque.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-station-windows.ps1" -Role station
echo Estacion Dell iniciada (modo teleconsulta).
echo Primera vez: inicie sesion como personal; luego la sesion se recuerda ~30 dias.
exit /b 0
