# Detiene los bridges MaindHealth (oxímetro, impresora, báscula).

$ports = @(3927, 3929, 3930)
foreach ($port in $ports) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      if ($c.OwningProcess -and $c.OwningProcess -gt 0) {
        Write-Host "Cerrando puerto $port (pid $($c.OwningProcess))"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

$PidFile = Join-Path $env:LOCALAPPDATA "MaindHealth\bridge-pids.txt"
if (Test-Path $PidFile) { Remove-Item $PidFile -Force }

Write-Host "Bridges detenidos."
