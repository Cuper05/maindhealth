# Instala arranque de Dell (teleconsulta) + kiosk touch al iniciar Windows.
# No requiere admin (carpeta Startup + tarea al iniciar sesion).

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Launcher = Join-Path $Root "start-station-windows.ps1"
$Vbs = Join-Path $Root "launch-hidden.vbs"
$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$CmdPath = Join-Path $StartupDir "MaindHealth-Estacion-Dell.cmd"
$OldKioskLnk = Join-Path $StartupDir "MaindHealth-Kiosko.lnk"
$TaskName = "MaindHealth-Estacion-Dell"
$WakeTaskName = "MaindHealth-Estacion-Wake"
$KeepAwakeTaskName = "MaindHealth-KeepAwake"
$KeepAwake = Join-Path $Root "keep-awake.ps1"

if (-not (Test-Path $Launcher)) {
  throw "No se encontro start-station-windows.ps1 en $Root"
}
if (-not (Test-Path $Vbs)) {
  throw "No se encontro launch-hidden.vbs en $Root"
}

New-Item -ItemType Directory -Force -Path $StartupDir | Out-Null

if (Test-Path $OldKioskLnk) {
  Remove-Item $OldKioskLnk -Force
  Write-Host "Eliminado acceso directo viejo del kiosk en Startup."
}

# Sin "timeout" visible: si sale una ventana negra al encender y la cierran, no abre nada.
$cmd = @"
@echo off
wscript.exe //B "$Vbs"
"@
Set-Content -Path $CmdPath -Value $cmd -Encoding ASCII
Write-Host "Startup: $CmdPath"

$wscript = Join-Path $env:SystemRoot "System32\wscript.exe"
$psArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Launcher`" -Role both -WaitForNetwork -WaitScreensSeconds 90"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs -WorkingDirectory $Root
  $logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $logon.Delay = "PT15S"
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $logon -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Tarea al iniciar sesion: $TaskName"
} catch {
  Write-Host "Aviso: no se pudo registrar la tarea de inicio de sesion. $($_.Exception.Message)"
}

Unregister-ScheduledTask -TaskName $WakeTaskName -Confirm:$false -ErrorAction SilentlyContinue
try {
  $wakeCmd = "schtasks.exe /Create /F /TN `"$WakeTaskName`" /SC ONEVENT /EC System /MO `"*[System[Provider[@Name='Microsoft-Windows-Kernel-Power'] and EventID=107]]`" /TR `"powershell.exe $psArgs`" /DELAY 0000:20"
  cmd.exe /c $wakeCmd | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Tarea al despertar: $WakeTaskName"
  } else {
    Write-Host "Aviso: no se pudo registrar la tarea al despertar (codigo $LASTEXITCODE)."
  }
} catch {
  Write-Host "Aviso: no se pudo registrar la tarea al despertar. $($_.Exception.Message)"
}

Unregister-ScheduledTask -TaskName $KeepAwakeTaskName -Confirm:$false -ErrorAction SilentlyContinue
try {
  if (-not (Test-Path $KeepAwake)) { throw "No se encontro keep-awake.ps1" }
  $awakeArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$KeepAwake`""
  $awakeAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $awakeArgs -WorkingDirectory $Root
  $awakeLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $awakeLogon.Delay = "PT40S"
  $awakeSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  $awakePrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $KeepAwakeTaskName -Action $awakeAction -Trigger $awakeLogon -Settings $awakeSettings -Principal $awakePrincipal -Force | Out-Null
  Write-Host "Tarea pantallas encendidas: $KeepAwakeTaskName"
} catch {
  Write-Host "Aviso: no se pudo registrar keep-awake. $($_.Exception.Message)"
}

try {
  Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" -Name "StartupDelayInMSec" -Value 0 -Type DWord -Force
} catch {
  New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" -Force | Out-Null
  Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize" -Name "StartupDelayInMSec" -Value 0 -Type DWord -Force
}

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
Write-Host "Arranque instalado. Al encender y entrar a Windows debe abrir:"
Write-Host "  Dell = teleconsulta (/estacion)"
Write-Host "  Touch = kiosk del paciente"
Write-Host ""
Write-Host "Iniciando Dell + kiosk ahora..."
Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Launcher,
  "-Role", "both", "-WaitForNetwork", "-WaitScreensSeconds", "20"
) -WorkingDirectory $Root
Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $KeepAwake
) -WorkingDirectory $Root
