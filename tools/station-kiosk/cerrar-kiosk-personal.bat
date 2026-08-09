@echo off
REM Solo para personal de la estacion — cierra el kiosk del paciente
REM (perfil MaindHealthKioskProfile). No cierra el Edge de la Dell.

echo Cerrando solo el kiosk MaindHealth...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$profile = Join-Path $env:LOCALAPPDATA 'MaindHealthKioskProfile'; ^
   $procs = Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $profile + '*') }; ^
   if (-not $procs) { Write-Host 'No habia kiosk abierto.' } else { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('Cerrado PID ' + $_.ProcessId) } }"

echo Listo.
pause
