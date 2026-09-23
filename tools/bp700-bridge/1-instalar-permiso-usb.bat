@echo off
title MaindHealth - permiso USB
cd /d "%~dp0"
echo.
echo ============================================
echo  MaindHealth: permiso USB (una sola vez)
echo ============================================
echo.
echo  Mire TAMBIEN la otra pantalla (la Dell).
echo  Windows va a preguntar: Permitir cambios?
echo  Pulse SI.
echo.
net session >nul 2>&1
if %errorLevel%==0 goto INSTALL

powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
echo.
echo Si ya pulso Si en Windows, esta listo.
echo Si la ventana se cerro sola, el aviso esta en la otra pantalla.
echo.
pause
exit /b 0

:INSTALL
echo Instalando...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-usb-gate.ps1"
if errorlevel 1 (
  echo.
  echo ERROR: no se pudo instalar. Deje esta ventana abierta y avise.
  pause
  exit /b 1
)
echo.
echo Listo. Ya puede cerrar esta ventana.
pause
exit /b 0
