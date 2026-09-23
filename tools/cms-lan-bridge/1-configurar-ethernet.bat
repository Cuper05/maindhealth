@echo off
cd /d "%~dp0"
echo MaindHealth - IP Ethernet para el monitor de signos vitales
echo Se pedira permiso de administrador.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0setup-ethernet.ps1\"' -Wait"
echo.
pause
