@echo off
echo El baumanometro USB BP-700 fue sustituido por el U90B Pro (BLE).
echo Arrancando tools\u90b-bridge ...
cd /d "%~dp0..\u90b-bridge"
node server.mjs
pause
