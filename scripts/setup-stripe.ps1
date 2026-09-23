# Configurar cobro Stripe (modo test) y verificar que el sistema responde.

Param(
  [string]$SecretKey = "",
  [string]$WebhookSecret = "",
  [string]$AppUrl = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "=== MaindHealth — setup cobro Stripe ===" -ForegroundColor Cyan
Write-Host ""

if (-not $SecretKey) {
  Write-Host "1) Abre https://dashboard.stripe.com/test/apikeys"
  Write-Host "2) Copia la Secret key (sk_test_...)"
  $SecretKey = Read-Host "Pega STRIPE_SECRET_KEY"
}

if (-not $SecretKey.StartsWith("sk_test_") -and -not $SecretKey.StartsWith("sk_live_")) {
  throw "La secret key debe empezar con sk_test_ o sk_live_"
}

if (-not $AppUrl) {
  Write-Host ""
  Write-Host "URL pública de la app (success/cancel de Checkout)."
  Write-Host "Ejemplos: https://health.maindsteel.com.mx  o  https://maindhealth.vercel.app"
  $AppUrl = Read-Host "NEXT_PUBLIC_APP_URL"
}
$AppUrl = $AppUrl.TrimEnd("/")
if ($AppUrl -notmatch "^https?://") {
  throw "NEXT_PUBLIC_APP_URL debe ser una URL completa (https://...)"
}

if (-not $WebhookSecret) {
  Write-Host ""
  Write-Host "Webhook (puedes dejarlo vacío y crearlo después en Stripe Dashboard):"
  Write-Host "  URL: $AppUrl/api/payments/webhook"
  Write-Host "  Evento: checkout.session.completed"
  $WebhookSecret = Read-Host "Pega STRIPE_WEBHOOK_SECRET (whsec_...) o Enter para omitir"
}

# Actualizar .env.local
$envPath = ".env.local"
$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
}

function Set-EnvLine([string[]]$src, [string]$key, [string]$value) {
  $found = $false
  $out = foreach ($line in $src) {
    if ($line -match "^$([regex]::Escape($key))=") {
      $found = $true
      "$key=$value"
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$key=$value" }
  return $out
}

$lines = Set-EnvLine $lines "STRIPE_SECRET_KEY" $SecretKey
$lines = Set-EnvLine $lines "NEXT_PUBLIC_APP_URL" $AppUrl
if ($WebhookSecret) {
  $lines = Set-EnvLine $lines "STRIPE_WEBHOOK_SECRET" $WebhookSecret
}
$lines | Set-Content $envPath -Encoding utf8
Write-Host ""
Write-Host "Guardado en .env.local" -ForegroundColor Green

# Validar key contra Stripe API
Write-Host "Validando secret key con Stripe API..."
$headers = @{
  Authorization = "Bearer $SecretKey"
}
try {
  $acct = Invoke-RestMethod -Uri "https://api.stripe.com/v1/account" -Headers $headers -Method Get
  Write-Host ("OK — cuenta Stripe: {0} (livemode={1})" -f $acct.id, $acct.charges_enabled) -ForegroundColor Green
} catch {
  throw "Stripe rechazó la secret key. Revisa que sea correcta y de Test mode si usas sk_test_."
}

Write-Host ""
Write-Host "Siguiente:" -ForegroundColor Cyan
Write-Host "  1. npm run dev"
Write-Host "  2. Abrir $AppUrl/api/payments/status  (debe ok:true si también hay webhook)"
Write-Host "  3. Probar kiosco: /estacion/paciente → Pagar con tarjeta"
Write-Host "  4. Tarjeta test: 4242 4242 4242 4242 / fecha futura / CVC 123"
Write-Host ""
Write-Host "Para producción (Vercel):"
Write-Host "  npx vercel env add STRIPE_SECRET_KEY production"
Write-Host "  npx vercel env add STRIPE_WEBHOOK_SECRET production"
Write-Host "  npx vercel env add NEXT_PUBLIC_APP_URL production"
Write-Host "  (valor: $AppUrl)"
Write-Host "  Luego redeploy."
