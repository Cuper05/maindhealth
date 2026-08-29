param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("disable", "enable")]
  [string]$Action,
  [ValidateSet("bp", "ecg", "all")]
  [string]$Target = "bp"
)

$ErrorActionPreference = "Stop"

function Get-TargetDevices([string]$Which) {
  $patterns = @()
  if ($Which -eq "bp" -or $Which -eq "all") {
    $patterns += "VID_10C4&PID_EA80"
  }
  if ($Which -eq "ecg" -or $Which -eq "all") {
    $patterns += "VID_0483&PID_5720"
  }
  Get-PnpDevice | Where-Object {
    $id = $_.InstanceId
    foreach ($p in $patterns) {
      if ($id -like "*$p*") { return $true }
    }
    return $false
  }
}

$devices = @(Get-TargetDevices $Target)
if (-not $devices.Count) {
  Write-Host "No hay dispositivos $Target en el arbol PnP."
  exit 0
}

if ($Action -eq "disable") {
  $ordered = $devices | Sort-Object { if ($_.InstanceId -like "HID\*") { 0 } else { 1 } }
  foreach ($d in $ordered) {
    if ($d.Status -eq "OK") {
      Disable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false
      Write-Host "disabled $($d.InstanceId)"
    }
  }
} else {
  $ordered = $devices | Sort-Object { if ($_.InstanceId -like "USB\*") { 0 } else { 1 } }
  foreach ($d in $ordered) {
    Enable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false
    Write-Host "enabled $($d.InstanceId)"
  }
}
