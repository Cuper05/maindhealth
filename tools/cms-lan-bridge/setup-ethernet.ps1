#Requires -RunAsAdministrator
# Pone esta PC como central CMS: 202.114.4.119 / 202.114.4.120 en Ethernet.
# El monitor (NET TYPE = CMS) envía TA, SpO2 y temperatura a esas IPs.

$ErrorActionPreference = "Stop"
$IfName = "Ethernet"

Write-Host "Configurando $IfName para el monitor de signos vitales..."

$adapter = Get-NetAdapter -Name $IfName -ErrorAction Stop
if ($adapter.Status -ne "Up") {
  throw "Ethernet no tiene enlace. Enchufe el RJ45 del monitor y espere a 100 Mbps."
}

function Add-IpIfMissing([string]$Ip, [int]$Prefix) {
  $exists = Get-NetIPAddress -InterfaceAlias $IfName -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -eq $Ip }
  if ($exists) {
    Write-Host "  ya estaba $Ip/$Prefix"
    return
  }
  New-NetIPAddress -InterfaceAlias $IfName -IPAddress $Ip -PrefixLength $Prefix -ErrorAction Stop | Out-Null
  Write-Host "  agregada $Ip/$Prefix"
}

Add-IpIfMissing "202.114.4.119" 24
Add-IpIfMissing "202.114.4.120" 24
Add-IpIfMissing "192.168.0.10" 24

try {
  Set-NetConnectionProfile -InterfaceAlias $IfName -NetworkCategory Private -ErrorAction Stop
  Write-Host "  perfil de red: Privada"
} catch {
  Write-Host "  perfil de red: no se pudo poner Privada ($($_.Exception.Message))"
}

$ports = 511, 515, 516, 517, 518, 519, 520
$ruleName = "MaindHealth CMS LAN monitor"
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ports -Profile Any | Out-Null
Write-Host "  firewall TCP $($ports -join ',') abierto"

Write-Host ""
Write-Host "IPs Ethernet:"
Get-NetIPAddress -InterfaceAlias $IfName -AddressFamily IPv4 | Format-Table IPAddress, PrefixLength -AutoSize
Write-Host "Listo. En el monitor: SYSTEM MENU -> NET CONFIG -> NET TYPE = CMS"
Write-Host "Si usa CUSTOM: SERVER IP = 202.114.4.119, LOCAL IP p.ej. 202.114.4.20, mascara 255.255.255.0"
