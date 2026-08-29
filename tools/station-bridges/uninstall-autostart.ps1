$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$CmdPath = Join-Path $StartupDir "MaindHealth-StationBridges.cmd"
if (Test-Path $CmdPath) {
  Remove-Item $CmdPath -Force
  Write-Host "Eliminado: $CmdPath"
} else {
  Write-Host "No habia acceso directo en Startup."
}
& (Join-Path $PSScriptRoot "stop.ps1")
