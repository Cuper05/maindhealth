# Lanza Edge en la Dell y/o la pantalla touch SIN modo --kiosk.
# --kiosk de Edge fuerza InPrivate: borra cookies y pide login en cada arranque.
# Tambien suele ignorar --window-position y se abre en el monitor principal.

param(
  [ValidateSet("station", "kiosk", "both")]
  [string]$Role = "both",
  [switch]$WaitForNetwork,
  [int]$WaitScreensSeconds = 25,
  # Solo si el personal pide kiosk en blanco. Por defecto NO borra la visita en curso.
  [switch]$NewKioskSession,
  # No mata Edge si ese perfil ya esta abierto (para keep-awake).
  [switch]$OnlyIfMissing,
  [string]$StationUrl = ""
)

$ErrorActionPreference = "Stop"
$UrlStation = if ($StationUrl) { $StationUrl } else { "https://health.maindsteel.com.mx/estacion" }
$UrlKiosk = if ($NewKioskSession) {
  "https://health.maindsteel.com.mx/estacion/paciente?nueva=1"
} else {
  "https://health.maindsteel.com.mx/estacion/paciente"
}
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

function Test-EdgeByNeedle([string]$Needle) {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like ("*" + $Needle + "*"))
  })
  return $procs.Count -gt 0
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

function Disable-EdgePasswordPrompts([string]$ProfileDir) {
  $prefs = Join-Path $ProfileDir "Default\Preferences"
  if (-not (Test-Path $prefs)) { return }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return }
  $script = @'
const fs = require("fs");
const p = process.argv[2];
try {
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.credentials_enable_service = false;
  j.credentials_enable_autosignin = false;
  j.password_manager = Object.assign({}, j.password_manager, {
    onboarding_shown: true,
    leak_detection: false
  });
  j.profile = j.profile || {};
  j.profile.password_manager_enabled = false;
  j.profile.password_manager_leak_detection = false;
  j.autofill = Object.assign({}, j.autofill, {
    profile_enabled: false,
    credit_card_enabled: false
  });
  if (j.partition) {
    j.partition.default_zoom_level = {};
    j.partition.per_host_zoom_levels = {};
  }
  fs.writeFileSync(p, JSON.stringify(j));
} catch (e) {
  process.stderr.write(String(e));
}
'@
  $tmp = Join-Path $env:TEMP "maindhealth-disable-passwords.js"
  Set-Content -Path $tmp -Value $script -Encoding ASCII
  & $node.Source $tmp $prefs
}

function Set-EdgeStationPasswordPolicy {
  try {
    $key = "HKCU:\SOFTWARE\Policies\Microsoft\Edge"
    if (-not (Test-Path $key)) {
      New-Item -Path $key -Force | Out-Null
    }
    New-ItemProperty -Path $key -Name "PasswordManagerEnabled" -Value 0 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $key -Name "PasswordMonitorAllowed" -Value 0 -PropertyType DWord -Force | Out-Null
  } catch {
    Write-Host "Aviso: no se pudo escribir politica de Edge (se desactiva el gestor de contrasenas en el perfil)."
  }
}

function Start-EdgeApp {
  param(
    [string]$ProfileDir,
    [string]$Url,
    $Screen
  )

  Disable-EdgePasswordPrompts -ProfileDir $ProfileDir

  $edge = Get-MsEdgePath
  $b = $Screen.Bounds
  $argList = @(
    ("--user-data-dir=" + $ProfileDir),
    ("--app=" + $Url),
    ("--window-position=" + $b.X + "," + $b.Y),
    ("--window-size=" + $b.Width + "," + $b.Height),
    "--start-fullscreen",
    "--disable-pinch",
    "--overscroll-history-navigation=0",
    "--no-first-run",
    "--disable-session-crashed-bubble",
    "--disable-features=TranslateUI,InfiniteSessionRestore,LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets,LocalNetworkAccessChecksWebRTC,PasswordManager,PasswordManagerOnboarding,PasswordImport",
    "--disable-save-password-bubble",
    "--check-for-update-interval=31536000"
  )
  $copyFix = Join-Path $PSScriptRoot "kiosk-copy-fix"
  if (($ProfileDir -like "*Kiosk*") -and (Test-Path $copyFix)) {
    $argList += ("--load-extension=" + $copyFix)
    $argList += ("--disable-extensions-except=" + $copyFix)
    $argList += "--remote-debugging-port=9229"
  }
  if ($ProfileDir -like "*Station*") {
    $argList += "--remote-debugging-port=9228"
    $argList += "--auto-accept-camera-and-microphone-capture"
  }
  Start-Process -FilePath $edge -ArgumentList $argList | Out-Null
  $profileName = Split-Path $ProfileDir -Leaf
  $window = Wait-EdgeWindow -ProfileName $profileName
  Move-EdgeToScreen -Window $window -Screen $Screen
  if (-not $window) {
    Write-Host ("Aviso: Edge arranco pero no se localizo la ventana de " + $profileName + " para moverla.")
  }
}

function Wait-MaindHealthNetwork([int]$Seconds = 90) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $r = Invoke-WebRequest -Uri $UrlStation -Method Head -TimeoutSec 8 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch {
      Write-Host "Esperando red hacia MaindHealth..."
    }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  Write-Host "Aviso: la red no respondio a tiempo; se abre igual."
  return $false
}

function Wait-SecondaryScreen([int]$Seconds) {
  $deadline = (Get-Date).AddSeconds([Math]::Max(0, $Seconds))
  do {
    $now = Get-StationScreens
    if ($now.Secondary) { return $now }
    Write-Host "Esperando el monitor Dell (teleconsulta)..."
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  return Get-StationScreens
}

if ($WaitForNetwork) {
  Write-Host "Esperando red..."
  [void](Wait-MaindHealthNetwork -Seconds 90)
}

# En esta PC Windows marca la ViewSonic (touch / kiosk) como monitor principal.
# Al encender, la Dell a veces tarda en encenderse: hay que esperarla o la
# teleconsulta se abre en el touch (o no se abre en la Dell).
$screens = Get-StationScreens
Set-EdgeStationPasswordPolicy
$kioskScreen = $screens.Primary
$needStation = ($Role -eq "station" -or $Role -eq "both")
if ($needStation -and -not $screens.Secondary) {
  $screens = Wait-SecondaryScreen -Seconds $WaitScreensSeconds
}
$stationScreen = $screens.Secondary
if (-not $stationScreen) {
  Write-Host "No aparecio la Dell; la teleconsulta usara el monitor disponible."
  $stationScreen = $screens.Primary
}

if ($Role -eq "station" -or $Role -eq "both") {
  if ($OnlyIfMissing -and (Test-EdgeByNeedle "MaindHealthStationProfile")) {
    Write-Host "Teleconsulta ya abierta; no se toca."
  } else {
    Write-Host "Cerrando Edge de estacion previo..."
    Stop-EdgeByNeedle "MaindHealthStationProfile"
    Write-Host ("Abriendo teleconsulta en Dell " + $stationScreen.Bounds)
    Start-EdgeApp -ProfileDir $ProfileStation -Url $UrlStation -Screen $stationScreen
    $openSala = Join-Path $PSScriptRoot "open-waiting-sala.mjs"
    if (Test-Path $openSala) {
      Start-Sleep -Milliseconds 800
      try {
        & node $openSala
      } catch {
        Write-Host ("Aviso: no se pudo abrir sala automaticamente: " + $_.Exception.Message)
      }
    }
  }
}

if ($Role -eq "kiosk" -or $Role -eq "both") {
  if ($OnlyIfMissing -and (Test-EdgeByNeedle "MaindHealthKioskProfile")) {
    Write-Host "Kiosk ya abierto; no se toca."
  } else {
    Write-Host "Cerrando Edge de kiosk previo..."
    Stop-EdgeByNeedle "MaindHealthKioskProfile"
    Stop-EdgeByNeedle "estacion/paciente"
    Stop-EdgeByNeedle "User Data Kiosk"
    Write-Host ("Abriendo kiosk paciente en " + $kioskScreen.Bounds)
    Start-EdgeApp -ProfileDir $ProfileKiosk -Url $UrlKiosk -Screen $kioskScreen
  }
}

function Start-KeepAwakeIfNeeded {
  $awake = Join-Path $PSScriptRoot "keep-awake.ps1"
  if (-not (Test-Path $awake)) { return }
  $running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like "*keep-awake.ps1*")
  })
  if ($running.Count -gt 0) { return }
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $awake
  ) | Out-Null
}

Start-KeepAwakeIfNeeded
Write-Host "Listo."
