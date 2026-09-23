' Lanza la estacion + kiosk sin ventana negra (si el usuario la cierra, no arranca).
Option Explicit
Dim sh, root, ps1, cmd
Set sh = CreateObject("WScript.Shell")
root = Replace(WScript.ScriptFullName, "\launch-hidden.vbs", "")
ps1 = root & "\start-station-windows.ps1"
cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """ -Role both -WaitForNetwork -WaitScreensSeconds 90"
sh.Run cmd, 0, False
