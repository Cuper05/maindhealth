@echo off
REM Instala arranque automatico: Dell en modo estacion al iniciar sesion Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart-estacion-dell.ps1"
pause
