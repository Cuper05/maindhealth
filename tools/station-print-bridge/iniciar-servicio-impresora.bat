@echo off
REM Servicio local de impresion silenciosa para el kiosko MaindHealth
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)

REM Opcional: nombre exacto de la impresora fisica (ver: npm run printers)
REM set STATION_PRINTER=Nombre de tu impresora

echo Iniciando bridge de impresion en 127.0.0.1:3929 ...
node server.mjs
pause
