@echo off
cd /d "%~dp0"
echo Iniciando bridge U90B Pro (BLE) en 127.0.0.1:3931 ...
node server.mjs
pause
