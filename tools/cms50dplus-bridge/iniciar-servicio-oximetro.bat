@echo off
cd /d "%~dp0"
title MaindHealth - Servicio oximetro CMS50D+
set CMS50_PORT=COM4
set BRIDGE_PORT=3927
echo.
echo ============================================
echo  Servicio local oximetro (dejar ABIERTO)
echo  http://127.0.0.1:3927
echo  Puerto serie: %CMS50_PORT%
echo ============================================
echo.
echo 1) Oximetro ENCENDIDO (pantalla con numeros)
echo 2) Dedo puesto hasta ver SpO2/FC en el aparato
echo 3) En Chrome, si pide permiso de "red local", Permitir
echo 4) En la web: Leer oximetro ahora
echo.
echo NO abras Web Serial ni leer-oximetro.bat a la vez.
echo.
node server.mjs
echo.
echo El servicio se detuvo.
pause
