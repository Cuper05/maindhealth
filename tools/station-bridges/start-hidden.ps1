# MaindHealth - bridges en segundo plano (sin ventanas).
# Oximetro :3927 | ECG :3928 | Impresora :3929 | Bascula :3930 | Presion :3931

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $env:LOCALAPPDATA "MaindHealth\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "No se encontro node en PATH. Instala Node.js LTS."
}

function Stop-ListenersOnPort([int]$Port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      if ($c.OwningProcess -and $c.OwningProcess -gt 0) {
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

function Start-Bridge {
  param(
    [string]$Name,
    [string]$WorkDir,
    [string]$Script,
    [hashtable]$EnvVars,
    [int]$Port,
    [string]$LogName
  )

  $scriptPath = Join-Path $WorkDir $Script
  if (-not (Test-Path $scriptPath)) {
    Write-Host "[skip] $Name - no existe $scriptPath"
    return
  }

  Stop-ListenersOnPort $Port
  Start-Sleep -Milliseconds 400

  $node = Get-NodeExe
  $logOut = Join-Path $LogDir "$LogName.out.log"
  $logErr = Join-Path $LogDir "$LogName.err.log"
  $wrapper = Join-Path $LogDir "run-$LogName.cmd"

  $lines = @()
  $lines += "@echo off"
  $lines += "cd /d `"$WorkDir`""
  foreach ($k in $EnvVars.Keys) {
    $lines += "set $k=$($EnvVars[$k])"
  }
  $lines += "`"$node`" `"$Script`" >> `"$logOut`" 2>> `"$logErr`""
  Set-Content -Path $wrapper -Value ($lines -join "`r`n") -Encoding ASCII

  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", "`"$wrapper`"") `
    -WindowStyle Hidden `
    -PassThru

  Write-Host "[ok] $Name fondo pid=$($proc.Id) port=$Port"
}

Write-Host "Iniciando bridges MaindHealth (ocultos)..."

Start-Bridge -Name "oximetro" `
  -WorkDir (Join-Path $Root "cms50dplus-bridge") `
  -Script "server.mjs" `
  -EnvVars @{ CMS50_PORT = "COM4"; BRIDGE_PORT = "3927" } `
  -Port 3927 `
  -LogName "oximetro"

Start-Bridge -Name "ecg" `
  -WorkDir (Join-Path $Root "ecg-bridge") `
  -Script "server.mjs" `
  -EnvVars @{ ECG_BRIDGE_PORT = "3928" } `
  -Port 3928 `
  -LogName "ecg"

Start-Bridge -Name "impresora" `
  -WorkDir (Join-Path $Root "station-print-bridge") `
  -Script "server.mjs" `
  -EnvVars @{ STATION_PRINT_PORT = "3929" } `
  -Port 3929 `
  -LogName "impresora"

Start-Bridge -Name "bascula" `
  -WorkDir (Join-Path $Root "hw701-scale-bridge") `
  -Script "server.mjs" `
  -EnvVars @{ HW701_PORT = "COM5"; HW701_BAUD = "4800"; BRIDGE_PORT = "3930" } `
  -Port 3930 `
  -LogName "bascula"

Start-Bridge -Name "presion" `
  -WorkDir (Join-Path $Root "bp700-bridge") `
  -Script "server.mjs" `
  -EnvVars @{ BP_BRIDGE_PORT = "3931"; BP_SERIAL = "TU0-700X" } `
  -Port 3931 `
  -LogName "presion"

Start-Sleep -Seconds 2

function Test-Health([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return [string]$r.StatusCode
  } catch {
    return "FAIL"
  }
}

Write-Host ""
Write-Host "Salud:"
Write-Host ("  oximetro  3927 = " + (Test-Health "http://127.0.0.1:3927/health"))
Write-Host ("  ecg       3928 = " + (Test-Health "http://127.0.0.1:3928/health"))
Write-Host ("  impresora 3929 = " + (Test-Health "http://127.0.0.1:3929/health"))
Write-Host ("  bascula   3930 = " + (Test-Health "http://127.0.0.1:3930/health"))
Write-Host ("  presion   3931 = " + (Test-Health "http://127.0.0.1:3931/health"))
Write-Host ""
Write-Host "Logs: $LogDir"
Write-Host "Puedes cerrar esta ventana. Los servicios siguen corriendo."
