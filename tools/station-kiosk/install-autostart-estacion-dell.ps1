# Instala arranque de Dell + kiosk touch al iniciar sesion.
# No requiere admin (carpeta Startup del usuario).

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Launcher = Join-Path $Root "start-station-windows.ps1"
$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$CmdPath = Join-Path $StartupDir "MaindHealth-Estacion-Dell.cmd"
$OldKioskLnk = Join-Path $StartupDir "MaindHealth-Kiosko.lnk"

if (-not (Test-Path $Launcher)) {
  throw "No se encontro start-station-windows.ps1 en $Root"
}

New-Item -ItemType Directory -Force -Path $StartupDir | Out-Null

# El .lnk viejo abria Edge --kiosk en el monitor principal (Dell), sin perfil.
if (Test-Path $OldKioskLnk) {
  Remove-Item $OldKioskLnk -Force
  Write-Host "Eliminado acceso directo viejo del kiosk en Startup (abria mal la pantalla)."
}

$cmd = @"
@echo off
REM Arranque MaindHealth: teleconsulta Dell + kiosk touch
timeout /t 10 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "$Launcher" -Role both
"@
Set-Content -Path $CmdPath -Value $cmd -Encoding ASCII

$w = New-Object -ComObject WScript.Shell
$stationBat = Join-Path $Root "iniciar-estacion-dell.bat"
$kioskBat = Join-Path $Root "iniciar-kiosk-touch.bat"
foreach ($dir in @(
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\Desktop")
)) {
  if (-not (Test-Path $dir)) { continue }

  $lnkPath = Join-Path $dir "MaindHealth-Estacion-Dell.lnk"
  $lnk = $w.CreateShortcut($lnkPath)
  $lnk.TargetPath = $stationBat
  $lnk.WorkingDirectory = $Root
  $lnk.Description = "MaindHealth modo estacion teleconsulta Dell"
  $lnk.Save()
  Write-Host "Acceso directo: $lnkPath"

  $kioskLnkPath = Join-Path $dir "MaindHealth-Kiosko.lnk"
  $kioskLnk = $w.CreateShortcut($kioskLnkPath)
  $kioskLnk.TargetPath = $kioskBat
  $kioskLnk.WorkingDirectory = $Root
  $kioskLnk.Description = "MaindHealth kiosk paciente pantalla touch"
  $kioskLnk.Save()
  Write-Host "Acceso directo: $kioskLnkPath"
}

Write-Host ""
Write-Host "Arranque instalado:"
Write-Host "  $CmdPath"
Write-Host ""
Write-Host "Iniciando Dell + kiosk ahora..."
Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Launcher, "-Role", "both"
) -WorkingDirectory $Root
