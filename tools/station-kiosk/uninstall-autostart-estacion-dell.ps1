# Quita el arranque automatico de la Dell (modo estacion).

$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
foreach ($name in @("MaindHealth-Estacion-Dell.cmd", "MaindHealth-Kiosko.lnk", "MaindHealth-Kiosko.cmd")) {
  $path = Join-Path $StartupDir $name
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Eliminado: $path"
  }
}

foreach ($taskName in @("MaindHealth-Estacion-Dell", "MaindHealth-Estacion-Wake", "MaindHealth-KeepAwake")) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  cmd.exe /c "schtasks.exe /Delete /F /TN `"$taskName`"" | Out-Null
  Write-Host "Tarea quitada (si existia): $taskName"
}
