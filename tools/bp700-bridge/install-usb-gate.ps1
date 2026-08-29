# Instala tareas SYSTEM para silenciar/reactivar el USB del baumanómetro
# sin que el paciente desconecte cables. Ejecutar UNA vez como administrador.

$ErrorActionPreference = "Stop"
$Gate = Join-Path $PSScriptRoot "usb-gate.ps1"
if (-not (Test-Path $Gate)) { throw "No existe $Gate" }

$ps = (Get-Command powershell.exe).Source

function Install-GateTask([string]$Name, [string]$Action) {
  $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Gate`" -Action $Action -Target bp"
  $actionObj = New-ScheduledTaskAction -Execute $ps -Argument $arg
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $Name -Action $actionObj -Principal $principal -Settings $settings -Force | Out-Null

  $svc = New-Object -ComObject Schedule.Service
  $svc.Connect()
  $folder = $svc.GetFolder("\")
  $task = $folder.GetTask($Name)
  $sddl = $task.GetSecurityDescriptor(1 + 2 + 4 + 8)
  if ($sddl -notmatch "AU") {
    $task.SetSecurityDescriptor($sddl + "(A;;GRGX;;;AU)", 0)
  }
  Write-Host "OK $Name"
}

Install-GateTask "MaindHealthBpUsbDisable" "disable"
Install-GateTask "MaindHealthBpUsbEnable" "enable"

Write-Host ""
Write-Host "Listo. El kiosko ya puede silenciar el USB sin desconectar cables."
