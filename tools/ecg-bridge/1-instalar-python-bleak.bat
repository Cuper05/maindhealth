@echo off
cd /d "%~dp0"
echo === MaindHealth: Python + bleak para MD100C_P ===

where python >nul 2>&1
if errorlevel 1 (
  echo Python no esta en PATH. Intentando winget...
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
)

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: instale Python 3 desde python.org y vuelva a ejecutar este .bat
  pause
  exit /b 1
)

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR al instalar bleak
  pause
  exit /b 1
)

echo.
echo Listo. Pruebe con: iniciar-servicio-ecg.bat
echo Luego reinicie los bridges: tools\station-bridges\iniciar-ahora-fondo.bat
pause
