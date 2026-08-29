@echo off
REM CIERRE FORZADO: mata TODO Microsoft Edge en esta PC (kiosk + personal en Dell).
REM Usar solo si cerrar-kiosk-personal.bat no encontro / no cerro el kiosk.

cd /d "%~dp0"
echo ========================================
echo  CIERRE FORZADO DE TODO MICROSOFT EDGE
echo  Cierra el kiosk Y el Edge del personal.
echo ========================================
echo.
choice /C SN /M "Continuar y cerrar TODO Edge"
if errorlevel 2 (
  echo Cancelado.
  pause
  exit /b 1
)
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cerrar-kiosk-edge.ps1" -ForceAllEdge
)
echo.
pause
exit /b 0
