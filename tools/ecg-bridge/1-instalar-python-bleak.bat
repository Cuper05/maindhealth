@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo === MaindHealth: Python + bleak para MD100C_P ===
echo.

rem Evita el "python.exe" falso de Microsoft Store (WindowsApps).
set "PY="

if defined ECG_PYTHON if exist "%ECG_PYTHON%" set "PY=%ECG_PYTHON%"

if not defined PY (
  for %%V in (314 313 312 311 310) do (
    if exist "%LocalAppData%\Programs\Python\Python%%V\python.exe" (
      set "PY=%LocalAppData%\Programs\Python\Python%%V\python.exe"
      goto :have_py
    )
  )
)

if not defined PY (
  if exist "%ProgramFiles%\Python312\python.exe" set "PY=%ProgramFiles%\Python312\python.exe"
)
if not defined PY (
  if exist "%ProgramFiles%\Python311\python.exe" set "PY=%ProgramFiles%\Python311\python.exe"
)
if not defined PY (
  if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
)

if not defined PY (
  where py >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%I in ('py -3 -c "import sys; print(sys.executable)" 2^>nul') do set "PY=%%I"
  )
)

:have_py
if defined PY goto :install_bleak

echo No hay Python real instalado (solo el acceso directo de Microsoft Store).
echo Instalando Python 3.12 con winget...
echo.

winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo ERROR: winget no pudo instalar Python.
  echo Instale manualmente desde https://www.python.org/downloads/
  echo Marque "Add python.exe to PATH" y vuelva a ejecutar este .bat
  echo.
  echo Tambien desactive los alias falsos:
  echo   Configuracion ^> Aplicaciones ^> Configuracion avanzada ^> Alias de ejecucion
  echo   Desactive "python.exe" y "python3.exe"
  pause
  exit /b 1
)

rem PATH de esta consola no se actualiza solo; buscamos el exe recien instalado.
set "PY="
for %%V in (314 313 312 311 310) do (
  if exist "%LocalAppData%\Programs\Python\Python%%V\python.exe" (
    set "PY=%LocalAppData%\Programs\Python\Python%%V\python.exe"
    goto :install_bleak
  )
)

where py >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%I in ('py -3 -c "import sys; print(sys.executable)" 2^>nul') do set "PY=%%I"
)

if not defined PY (
  echo.
  echo Python se instalo, pero esta consola no lo ve aun.
  echo Cierre esta ventana, abra otra y vuelva a ejecutar este .bat
  pause
  exit /b 1
)

:install_bleak
echo Usando: %PY%
"%PY%" -c "import sys; print(sys.version)"
if errorlevel 1 (
  echo ERROR: ese Python no arranca.
  pause
  exit /b 1
)

echo.
echo Instalando bleak...
"%PY%" -m pip install --upgrade pip
"%PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 (
  echo ERROR al instalar bleak
  pause
  exit /b 1
)

echo.
echo Listo.
echo 1^) Pruebe: iniciar-servicio-ecg.bat
echo 2^) Reinicie bridges: ..\station-bridges\iniciar-ahora-fondo.bat
echo 3^) Si "python" sigue fallando en CMD, desactive los alias de Microsoft Store
echo    ^(python.exe / python3.exe^) en Configuracion ^> Aplicaciones ^> Alias de ejecucion.
pause
endlocal
