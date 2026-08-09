@echo off
cd /d "%~dp0"
echo Iniciando servicio local del oximetro (dejar esta ventana abierta)...
node server.mjs
pause
