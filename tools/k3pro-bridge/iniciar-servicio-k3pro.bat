@echo off
cd /d "%~dp0"
echo Iniciando bridge K3 Pro en 127.0.0.1:3933 (COM8 @ 115200) ...
node server.mjs
pause
