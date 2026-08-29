# Cierra Edge del kiosk paciente (perfil / URL / --kiosk).
# Uso:
#   .\cerrar-kiosk-edge.ps1              # solo kiosk
#   .\cerrar-kiosk-edge.ps1 -ForceAllEdge # TODO Edge (personal + kiosk)
#   .\cerrar-kiosk-edge.ps1 -Quiet       # menos salida (para iniciar/recargar)

param(
  [switch]$ForceAllEdge,
  [switch]$Quiet
)

$ErrorActionPreference = 'SilentlyContinue'

function Write-Info([string]$msg) {
  if (-not $Quiet) { Write-Host $msg }
}

function Get-KioskEdgeProcesses {
  $profileFwd = (Join-Path $env:LOCALAPPDATA 'MaindHealthKioskProfile') -replace '\\', '/'
  $profileBack = Join-Path $env:LOCALAPPDATA 'MaindHealthKioskProfile'
  $profileName = 'MaindHealthKioskProfile'

  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }

    $hasProfile =
      ($cmd -like ("*" + $profileName + "*")) -or
      ($cmd -like ("*" + $profileBack + "*")) -or
      ($cmd -like ("*" + $profileFwd + "*")) -or
      ($cmd -match 'MaindHealthKioskProfile')

    $hasPacienteUrl = $cmd -match 'estacion/paciente'
    $isStation =
      ($cmd -match 'MaindHealthStationProfile') -or
      ($cmd -match 'estacion/sala') -or
      ($cmd -match '/estacion"') -or
      ($cmd -match '/estacion ')

    $hasKioskMaind =
      ($cmd -match '--kiosk') -and
      ($cmd -match 'health\.maindsteel') -and
      -not $isStation

    return (-not $isStation) -and ($hasProfile -or $hasPacienteUrl -or $hasKioskMaind)
  }
}

function Stop-EdgePids {
  param([int[]]$Pids)

  $closed = New-Object System.Collections.Generic.List[int]
  foreach ($procId in ($Pids | Select-Object -Unique)) {
    if (-not $procId) { continue }
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      [void]$closed.Add($procId)
      Write-Info ("  Stop-Process PID " + $procId)
    } catch {
      Write-Info ("  No se pudo Stop-Process PID " + $procId + ": " + $_.Exception.Message)
    }
  }

  Start-Sleep -Seconds 1

  $still = New-Object System.Collections.Generic.List[int]
  foreach ($procId in $closed) {
    $alive = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($alive) { [void]$still.Add($procId) }
  }

  foreach ($procId in $still) {
    Write-Info ("  Reintento taskkill /F PID " + $procId)
    & taskkill.exe /F /PID $procId 2>$null | Out-Null
  }

  Start-Sleep -Milliseconds 500
  return $closed.Count
}

if ($ForceAllEdge) {
  Write-Info 'ADVERTENCIA: se cerraran TODOS los procesos de Microsoft Edge (kiosk y personal).'
  $all = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'")
  if ($all.Count -eq 0) {
    Write-Info 'No habia ningun Microsoft Edge abierto.'
    exit 0
  }
  $edgePids = @($all | ForEach-Object { [int]$_.ProcessId })
  Write-Info ("Encontrados " + $edgePids.Count + " proceso(s) msedge.exe. Cerrando...")
  $n = Stop-EdgePids -Pids $edgePids
  $left = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'").Count
  if ($left -eq 0) {
    Write-Info ("Listo. Se intentaron cerrar " + $n + " proceso(s). Edge ya no esta en ejecucion.")
  } else {
    Write-Info ("Se intentaron cerrar " + $n + " proceso(s). Aun quedan " + $left + " proceso(s) de Edge.")
    Write-Info 'Abre el Administrador de tareas (Ctrl+Shift+Esc) > Detalles > msedge.exe > Finalizar tarea.'
  }
  exit 0
}

$procs = @(Get-KioskEdgeProcesses)
if ($procs.Count -eq 0) {
  Write-Info 'No se encontro el kiosk del paciente (ningun Edge con MaindHealthKioskProfile, estacion/paciente o --kiosk + maindsteel).'
  Write-Info ''
  Write-Info 'Si la pantalla kiosk sigue abierta:'
  Write-Info '  1) Ejecuta cerrar-kiosk-forzado.bat (cierra TODO Edge, incluido el del personal).'
  Write-Info '  2) O Administrador de tareas (Ctrl+Shift+Esc) > procesos de Microsoft Edge del kiosk > Finalizar tarea.'
  exit 1
}

$edgePids = @($procs | ForEach-Object { [int]$_.ProcessId } | Select-Object -Unique)
Write-Info ("Encontrados " + $edgePids.Count + " proceso(s) del kiosk. Cerrando...")
$n = Stop-EdgePids -Pids $edgePids

$left = @(Get-KioskEdgeProcesses)
if ($left.Count -eq 0) {
  Write-Info ("Listo. Se cerraron " + $n + " proceso(s) del kiosk. El Edge del personal no se toco (filtro por perfil/URL).")
  exit 0
}

Write-Info ("Quedan " + $left.Count + " proceso(s) del kiosk tras el cierre.")
Write-Info 'Prueba cerrar-kiosk-forzado.bat o Administrador de tareas (Ctrl+Shift+Esc) > Microsoft Edge (kiosk) > Finalizar tarea.'
exit 2