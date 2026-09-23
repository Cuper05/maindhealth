@echo off
cd /d "%~dp0"
title MaindHealth - Capturar trama HW-701
REM Pon aqui el COM correcto (el de listar-puertos.bat)
set HW701_PORT=COM5
set HW701_BAUD=4800
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo.
echo Abriendo %HW701_PORT% @ %HW701_BAUD% por 60 segundos.
echo SUBASE a la bascula ahora y espere la medicion.
echo.
node sniff.mjs %HW701_PORT% %HW701_BAUD%
echo.
pause
