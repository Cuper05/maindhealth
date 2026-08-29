# Lanza Edge en la Dell y/o la pantalla touch SIN modo --kiosk.
# --kiosk de Edge fuerza InPrivate: borra cookies y pide login en cada arranque.
# Tambien suele ignorar --window-position y se abre en el monitor principal.

param(
  [ValidateSet("station", "kiosk", "both")]
  [string]$Role = "both",
  [switch]$WaitForNetwork
)

$ErrorActionPreference = "Stop"
$UrlStation = "https://health.maindsteel.com.mx/estacion"
$UrlKiosk = "https://health.maindsteel.com.mx/estacion/paciente?nueva=1"
$ProfileStation = Join-Path $env:LOCALAPPDATA "MaindHealthStationProfile"
$ProfileKiosk = Join-Path $env:LOCALAPPDATA "MaindHealthKioskProfile"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MaindHealthWin32 {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

function Get-MsEdgePath {
  foreach ($candidate in @(
      "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )) {
    if (Test-Path $candidate) { return $candidate }
  }
  throw "No se encontro Microsoft Edge."
}

function Get-StationScreens {
  Add-Type -AssemblyName System.Windows.Forms
  $all = @([System.Windows.Forms.Screen]::AllScreens)
  $primary = $all | Where-Object { $_.Primary } | Select-Object -First 1
  $secondary = $all | Where-Object { -not $_.Primary } | Select-Object -First 1
  if (-not $primary) { throw "No se detecto monitor principal." }
  return [pscustomobject]@{
    Primary   = $primary
    Secondary = $secondary
  }
}

function Stop-EdgeByNeedle([string]$Needle) {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -and ($_.CommandLine -like ("*" + $Needle + "*"))
    })
  foreach ($proc in $procs) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
  if ($procs.Count -gt 0) {
    Start-Sleep -Seconds 1
  }
}

function Wait-EdgeWindow([string]$ProfileName, [int]$TimeoutSec = 25) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    $windows = @(Get-Process msedge -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowHandle -ne [IntPtr]::Zero
      })
    foreach ($window in $windows) {
      $cim = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $window.Id) -ErrorAction SilentlyContinue
      if ($cim -and $cim.CommandLine -and ($cim.CommandLine -like ("*" + $ProfileName + "*"))) {
        return $window
      }
    }
    Start-Sleep -Milliseconds 400
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Move-EdgeToScreen($Window, $Screen) {
  if (-not $Window) { return }
  $hwnd = $Window.MainWindowHandle
  $b = $Screen.Bounds
  [void][MaindHealthWin32]::ShowWindow($hwnd, 9) # SW_RESTORE
  Start-Sleep -Milliseconds 200
  [void][MaindHealthWin32]::SetWindowPos($hwnd, [IntPtr]::Zero, $b.X, $b.Y, $b.Width, $b.Height, 0x0040)
}

function Start-EdgeApp {
  param(
    [string]$ProfileDir,
    [string]$Url,
    $Screen
  )

  $edge = Get-MsEdgePath
  $b = $Screen.Bounds
  $argList = @(
    ("--user-data-dir=" + $ProfileDir),
    ("--app=" + $Url),
    ("--window-position=" + $b.X + "," + $b.Y),
    ("--window-size=" + $b.Width + "," + $b.Height),
    "--start-fullscreen",
    "--no-first-run",
    "--disable-session-crashed-bubble",
    "--disable-features=TranslateUI,InfiniteSessionRestore",
    "--check-for-update-interval=31536000"
  )
  Start-Process -FilePath $edge -ArgumentList $argList | Out-Null
  $profileName = Split-Path $ProfileDir -Leaf
  $window = Wait-EdgeWindow -ProfileName $profileName
  Move-EdgeToScreen -Window $window -Screen $Screen
  if (-not $window) {
    Write-Host ("Aviso: Edge arranco pero no se localizo la ventana de " + $profileName + " para moverla.")
  }
}

if ($WaitForNetwork) {
  Write-Host "Esperando red..."
  Start-Sleep -Seconds 8
}

$screens = Get-StationScreens
# En esta PC Windows marca la ViewSonic (touch / kiosk) como monitor principal.
# La Dell de teleconsulta es el monitor secundario.
$kioskScreen = $screens.Primary
$stationScreen = $screens.Secondary
if (-not $stationScreen) {
  Write-Host "No hay pantalla secundaria; la teleconsulta usara el mismo monitor que el kiosk."
  $stationScreen = $screens.Primary
}

if ($Role -eq "station" -or $Role -eq "both") {
  Write-Host "Cerrando Edge de estacion previo..."
  Stop-EdgeByNeedle "MaindHealthStationProfile"
  Write-Host ("Abriendo teleconsulta en Dell " + $stationScreen.Bounds)
  Start-EdgeApp -ProfileDir $ProfileStation -Url $UrlStation -Screen $stationScreen
}

if ($Role -eq "kiosk" -or $Role -eq "both") {
  Write-Host "Cerrando Edge de kiosk previo..."
  Stop-EdgeByNeedle "MaindHealthKioskProfile"
  Stop-EdgeByNeedle "estacion/paciente"
  Stop-EdgeByNeedle "User Data Kiosk"
  Write-Host ("Abriendo kiosk paciente en " + $kioskScreen.Bounds)
  Start-EdgeApp -ProfileDir $ProfileKiosk -Url $UrlKiosk -Screen $kioskScreen
}

Write-Host "Listo."
