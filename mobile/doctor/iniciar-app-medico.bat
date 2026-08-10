@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo  MaindHealth Medicos - Metro (dev)
echo ========================================
echo.
echo PRIMERO instala la app real con EAS.
echo Lee: INSTALAR-APP-REAL.md
echo.
echo Este script solo arranca Metro para un
echo development build YA instalado en el telefono.
echo NO uses Expo Go. NO abras Safari como app.
echo.
echo Deja esta ventana ABIERTA mientras desarrollas.
echo.
set CI=
set EXPO_NO_TELEMETRY=1
npx expo start --dev-client --lan
pause
