@echo off
REM MaindHealth - Reinicia SOLO el kiosk touch (Edge).
REM NO cierra oximetro, bascula, impresora ni otras terminales.

cd /d "%~dp0"
echo.
echo ============================================
echo  Recargar kiosk (solo Edge)
echo  Deje ABIERTOS:
echo   - iniciar-servicio-oximetro.bat
echo   - iniciar-servicio-bascula.bat
echo   - iniciar-servicio-impresora.bat
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-station-windows.ps1" -Role kiosk
echo.
echo Listo. Si cerro las terminales de oximetro/bascula por error, vuelva a abrirlas.
timeout /t 4 >nul
exit /b 0
