@echo off
cd /d "%~dp0"
title MaindHealth - Listar COM bascula
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo.
node sniff.mjs --list
echo.
pause
