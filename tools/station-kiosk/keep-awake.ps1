# Mantiene encendidas las dos pantallas de la estacion (Dell + ViewSonic).
# Windows ya tiene "apagar pantalla = nunca", pero los monitores se duermen solos
# si no hay senal / actividad; al despertar, Edge se sale de esas pantallas.
# Este proceso se queda vivo y:
#   1) pide a Windows que no apague display ni suspenda
#   2) si se cayo Edge de kiosk o teleconsulta, lo reabre SIN borrar la sesion
# No mueve el puntero encima del kiosko: en la ViewSonic eso deja una marca
# como si un dedo siguiera presionando y la pantalla se dispara sola.

$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot
$Launcher = Join-Path $Root "start-station-windows.ps1"
$LogDir = Join-Path $env:LOCALAPPDATA "MaindHealth\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "keep-awake.log"

function Write-AwakeLog([string]$Message) {
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message
  try { Add-Content -Path $Log -Value $line -Encoding UTF8 } catch { }
}

$mutex = $null
try {
  $mutex = New-Object System.Threading.Mutex($false, "Global\MaindHealthKeepAwake")
  if (-not $mutex.WaitOne(0, $false)) {
    Write-AwakeLog "Ya hay un keep-awake. Salgo."
    exit 0
  }
} catch {
  Write-AwakeLog ("Mutex: " + $_.Exception.Message)
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MaindHealthKeepAwake {
  public const uint ES_CONTINUOUS = 0x80000000;
  public const uint ES_SYSTEM_REQUIRED = 0x00000001;
  public const uint ES_DISPLAY_REQUIRED = 0x00000002;
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
}
"@

function Keep-DisplayAlive {
  [void][MaindHealthKeepAwake]::SetThreadExecutionState(
    [MaindHealthKeepAwake]::ES_CONTINUOUS -bor
    [MaindHealthKeepAwake]::ES_SYSTEM_REQUIRED -bor
    [MaindHealthKeepAwake]::ES_DISPLAY_REQUIRED
  )
}

function Park-CursorOffKiosk {
  # Solo si el puntero ya esta en el kiosko (monitor principal). No se mueve
  # un pixel ahi: ese movimiento deja el boton de abajo marcado como tocado.
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    $screens = @([System.Windows.Forms.Screen]::AllScreens)
    $primary = $screens | Where-Object { $_.Primary } | Select-Object -First 1
    $secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
    if (-not $primary -or -not $secondary) { return }
    $pt = New-Object MaindHealthKeepAwake+POINT
    if (-not [MaindHealthKeepAwake]::GetCursorPos([ref]$pt)) { return }
    $b = $primary.Bounds
    $onKiosk = ($pt.X -ge $b.X -and $pt.X -lt ($b.X + $b.Width) -and $pt.Y -ge $b.Y -and $pt.Y -lt ($b.Y + $b.Height))
    if (-not $onKiosk) { return }
    $sb = $secondary.Bounds
    $kcx = $b.X + ($b.Width / 2)
    $kcy = $b.Y + ($b.Height / 2)
    $corners = @(
      @{ X = $sb.X + 12; Y = $sb.Y + 12 },
      @{ X = $sb.X + $sb.Width - 12; Y = $sb.Y + 12 },
      @{ X = $sb.X + 12; Y = $sb.Y + $sb.Height - 12 },
      @{ X = $sb.X + $sb.Width - 12; Y = $sb.Y + $sb.Height - 12 }
    )
    $far = $corners | Sort-Object { ($_.X - $kcx) * ($_.X - $kcx) + ($_.Y - $kcy) * ($_.Y - $kcy) } -Descending | Select-Object -First 1
    [void][MaindHealthKeepAwake]::SetCursorPos([int]$far.X, [int]$far.Y)
    Write-AwakeLog ("Puntero salio del kiosko hacia " + [int]$far.X + "," + [int]$far.Y)
  } catch { }
}

function Test-EdgeProfile([string]$Needle) {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like ("*" + $Needle + "*"))
  })
  return $procs.Count -gt 0
}

function Repair-MissingEdge {
  if (-not (Test-Path $Launcher)) { return }
  $needKiosk = -not (Test-EdgeProfile "MaindHealthKioskProfile")
  $needStation = -not (Test-EdgeProfile "MaindHealthStationProfile")
  if (-not $needKiosk -and -not $needStation) { return }

  $role = if ($needKiosk -and $needStation) { "both" } elseif ($needKiosk) { "kiosk" } else { "station" }
  Write-AwakeLog ("Edge faltaba ($role). Relanzando sin reset de sesion.")
  try {
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
      "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
      "-File", $Launcher, "-Role", $role, "-OnlyIfMissing"
    ) -WorkingDirectory $Root | Out-Null
  } catch {
    Write-AwakeLog ("Relanzar fallo: " + $_.Exception.Message)
  }
}

Write-AwakeLog "Keep-awake iniciado."
Keep-DisplayAlive
Park-CursorOffKiosk
$lastNudge = Get-Date
$lastRepair = [DateTime]::MinValue
$lastSala = [DateTime]::MinValue

try {
  while ($true) {
    Keep-DisplayAlive
    if (((Get-Date) - $lastNudge).TotalSeconds -ge 15) {
      Park-CursorOffKiosk
      $lastNudge = Get-Date
    }
    if (((Get-Date) - $lastRepair).TotalSeconds -ge 45) {
      Repair-MissingEdge
      $lastRepair = Get-Date
    }
    if (((Get-Date) - $lastSala).TotalSeconds -ge 8) {
      try {
        $openSala = Join-Path $Root "open-waiting-sala.mjs"
        if (Test-Path $openSala) {
          $node = Get-Command node -ErrorAction SilentlyContinue
          if ($node) {
            & $node.Source $openSala 2>> $Log | Out-Null
          }
        }
      } catch {
        Write-AwakeLog ("open-sala: " + $_.Exception.Message)
      }
      $lastSala = Get-Date
    }
    Start-Sleep -Seconds 20
  }
} finally {
  [void][MaindHealthKeepAwake]::SetThreadExecutionState([MaindHealthKeepAwake]::ES_CONTINUOUS)
  if ($mutex) { try { $mutex.ReleaseMutex() | Out-Null } catch { } }
  Write-AwakeLog "Keep-awake termino."
}
