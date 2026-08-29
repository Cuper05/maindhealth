@echo off
REM Solo para personal de la estacion - cierra el kiosk del paciente
REM (perfil MaindHealthKioskProfile / URL paciente). Evita cerrar Edge del personal.

cd /d "%~dp0"
echo Cerrando solo el kiosk MaindHealth...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cerrar-kiosk-edge.ps1"
set ERR=%ERRORLEVEL%
if %ERR% NEQ 0 (
  echo.
  echo Si el kiosk sigue en pantalla, ejecuta: cerrar-kiosk-forzado.bat
  echo O Ctrl+Shift+Esc ^> Microsoft Edge del kiosk ^> Finalizar tarea.
)
echo.
pause
exit /b %ERR%
