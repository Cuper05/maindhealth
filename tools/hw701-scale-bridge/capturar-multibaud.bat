@echo off
cd /d "%~dp0"
title MaindHealth - Multibaud HW-701
set HW701_PORT=COM5
REM Opcional: pon el peso/altura que ves en el LED (altura en cm)
REM Ejemplo: node sniff-multibaud.mjs COM5 --weight 72.5 --height 168
if not exist node_modules call npm install
echo.
echo Encienda la bascula, ejecute esto y SUBASE ahora.
echo Duracion aprox. 70-90 segundos (varios baud).
echo.
node sniff-multibaud.mjs %HW701_PORT% %*
echo.
pause
