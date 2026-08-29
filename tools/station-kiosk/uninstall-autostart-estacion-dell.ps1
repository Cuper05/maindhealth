# Quita el arranque automatico de la Dell (modo estacion).

$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
foreach ($name in @("MaindHealth-Estacion-Dell.cmd", "MaindHealth-Kiosko.lnk", "MaindHealth-Kiosko.cmd")) {
  $path = Join-Path $StartupDir $name
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Eliminado: $path"
  }
}
