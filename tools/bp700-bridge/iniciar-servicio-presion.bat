@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando node-hid...
  call npm install
)
echo Iniciando bridge baumanometro en 127.0.0.1:3931 ...
node server.mjs
pause
