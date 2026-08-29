# Instala arranque al iniciar sesion (carpeta Startup, sin admin).

$ErrorActionPreference = "Stop"
$Script = Join-Path $PSScriptRoot "start-hidden.ps1"
$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$CmdPath = Join-Path $StartupDir "MaindHealth-StationBridges.cmd"

New-Item -ItemType Directory -Force -Path $StartupDir | Out-Null

$cmd = @"
@echo off
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$Script"
"@
Set-Content -Path $CmdPath -Value $cmd -Encoding ASCII

Write-Host "Arranque instalado en Startup:"
Write-Host "  $CmdPath"
Write-Host ""
Write-Host "Arrancando bridges ahora..."
& $Script
