@echo off
cd /d "%~dp0"
echo Iniciando bridge ECG PC-80B en 127.0.0.1:3928 ...
node server.mjs
pause
