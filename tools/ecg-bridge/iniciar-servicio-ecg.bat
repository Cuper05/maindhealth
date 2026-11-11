@echo off
cd /d "%~dp0"
echo Iniciando bridge ECG MD100C_P (BLE) en 127.0.0.1:3928 ...
node server.mjs
pause
