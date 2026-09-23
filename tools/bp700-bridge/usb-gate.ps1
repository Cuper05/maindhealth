param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("disable", "enable")]
  [string]$Action,
  [ValidateSet("bp", "ecg", "all")]
  [string]$Target = "bp"
)

$ErrorActionPreference = "Continue"
$CacheDir = Join-Path $env:ProgramData "MaindHealth"
$HubCache = Join-Path $CacheDir "bp-hub-instance.txt"

function Set-DeviceState([string]$Id, [string]$Op) {
  if (-not $Id) { return }
  try {
    if ($Op -eq "disable") {
      Disable-PnpDevice -InstanceId $Id -Confirm:$false -ErrorAction Stop
      Write-Host "disabled $Id"
    } else {
      Enable-PnpDevice -InstanceId $Id -Confirm:$false -ErrorAction Stop
      Write-Host "enabled $Id"
    }
  } catch {
    Write-Host "$Op-err $Id $($_.Exception.Message)"
    if ($Op -eq "disable") {
      & pnputil.exe /disable-device $Id | ForEach-Object { Write-Host $_ }
    } else {
      & pnputil.exe /enable-device $Id | ForEach-Object { Write-Host $_ }
    }
  }
}

function Get-BpHubId {
  $usb = @(Get-PnpDevice | Where-Object {
      $_.InstanceId -like "USB\VID_10C4&PID_EA80*"
    }) | Select-Object -First 1
  if ($usb) {
    $parent = (Get-PnpDeviceProperty -InstanceId $usb.InstanceId -KeyName DEVPKEY_Device_Parent -ErrorAction SilentlyContinue).Data
    if ($parent -like "USB\VID_*") {
      New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
      Set-Content -Path $HubCache -Value $parent -Encoding ASCII
      return $parent
    }
  }
  if (Test-Path $HubCache) {
    return (Get-Content -Path $HubCache -Raw).Trim()
  }
  return $null
}

if ($Target -eq "bp" -or $Target -eq "all") {
  if ($Action -eq "disable") {
    $hub = Get-BpHubId
    if ($hub) {
      Set-DeviceState $hub "disable"
    } else {
      Write-Host "no-bp-hub"
    }
  } else {
    $hub = $null
    if (Test-Path $HubCache) { $hub = (Get-Content -Path $HubCache -Raw).Trim() }
    if (-not $hub) { $hub = Get-BpHubId }
    if ($hub) { Set-DeviceState $hub "enable" }
    Get-PnpDevice | Where-Object { $_.InstanceId -like "USB\VID_10C4&PID_EA80*" } | ForEach-Object {
      Set-DeviceState $_.InstanceId "enable"
    }
    Get-PnpDevice | Where-Object {
      $_.InstanceId -like "USB\VID_0000&PID_0002*" -and $_.Problem -eq "CM_PROB_FAILED_POST_START"
    } | ForEach-Object {
      Write-Host "remove-failed $($_.InstanceId)"
      & pnputil.exe /remove-device $_.InstanceId | ForEach-Object { Write-Host $_ }
    }
    & pnputil.exe /scan-devices | Out-Null
  }
}

if ($Target -eq "ecg" -or $Target -eq "all") {
  Get-PnpDevice | Where-Object { $_.InstanceId -like "*VID_0483&PID_5720*" } | ForEach-Object {
    Set-DeviceState $_.InstanceId $Action
  }
}
