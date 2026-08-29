@echo off
net session >nul 2>&1
if not %errorLevel%==0 (
  echo Se necesita un permiso de Windows UNA sola vez (baumanómetro y ECG).
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-usb-gate.ps1"
echo.
pause
