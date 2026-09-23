@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo No se encontro Node.js en PATH.
  pause
  exit /b 1
)
echo Iniciando puente Ethernet del monitor en 127.0.0.1:3932
node server.mjs
pause
