@echo off
REM Bloquea Alt+F4 / F11 / Ctrl+W mientras corre el kiosk (solo en esta PC).
REM Cierra esta ventana negra para quitar el bloqueo, o usa cerrar-kiosk-personal.bat

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bloquear-teclas-kiosk.ps1"
