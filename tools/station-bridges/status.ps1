function Test-Health([string]$Name, [string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    Write-Host ("[ok]   {0,-10} {1}" -f $Name, $r.StatusCode)
  } catch {
    Write-Host ("[fail] {0,-10} no responde" -f $Name)
  }
}

Write-Host "Estado bridges MaindHealth:"
Test-Health "oximetro"  "http://127.0.0.1:3927/health"
Test-Health "ecg"       "http://127.0.0.1:3928/health"
Test-Health "impresora" "http://127.0.0.1:3929/health"
Test-Health "bascula"   "http://127.0.0.1:3930/health"
Test-Health "presion"   "http://127.0.0.1:3931/health"
