@echo off
cd /d "%~dp0"
title MaindHealth - Servicio oximetro (solo debug)
echo.
echo Ya no dejes esta ventana abierta.
echo Usa: tools\station-bridges\1-instalar-arranque-automatico.bat
echo.
set CMS50_PORT=COM4
set BRIDGE_PORT=3927
node server.mjs
pause
