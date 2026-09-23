@echo off
cd /d "%~dp0"
title MaindHealth - Servicio bascula (solo debug)
echo.
echo Ya no dejes esta ventana abierta.
echo Usa: tools\station-bridges\1-instalar-arranque-automatico.bat
echo.
set HW701_PORT=COM7
set HW701_BAUD=4800
set BRIDGE_PORT=3930
if not exist node_modules call npm install
node server.mjs
pause
