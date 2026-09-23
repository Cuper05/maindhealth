@echo off
cd /d "%~dp0"
title MaindHealth - Probar lectura bascula
echo.
echo Deje abierto iniciar-servicio-bascula.bat
echo Luego ejecute ESTE script, SUBASE a la bascula y espere.
echo.
curl -s -X POST http://127.0.0.1:3930/read
echo.
echo.
echo Revise tambien la ventana del servicio: ahi deben salir los bytes y el peso/altura.
pause
