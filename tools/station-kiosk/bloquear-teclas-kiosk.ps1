# Bloquea teclas comunes de cierre mientras exista el Edge del kiosk.
# Ejecutar como personal junto con iniciar-kiosk-touch.bat (dejar ventana abierta).

$ErrorActionPreference = "SilentlyContinue"
$profile = Join-Path $env:LOCALAPPDATA "MaindHealthKioskProfile"

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KioskKeyBlock : IDisposable {
  private const int WH_KEYBOARD_LL = 13;
  private const int WM_KEYDOWN = 0x0100;
  private const int WM_SYSKEYDOWN = 0x0104;
  private LowLevelKeyboardProc _proc;
  private IntPtr _hook = IntPtr.Zero;
  private string _profileNeedle;

  public KioskKeyBlock(string profileNeedle) {
    _profileNeedle = profileNeedle.ToLowerInvariant();
    _proc = HookCallback;
    using (Process cur = Process.GetCurrentProcess())
    using (ProcessModule mod = cur.MainModule) {
      _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(mod.ModuleName), 0);
    }
  }

  private bool KioskEdgeFocused() {
    IntPtr hwnd = GetForegroundWindow();
    if (hwnd == IntPtr.Zero) return false;
    uint pid;
    GetWindowThreadProcessId(hwnd, out pid);
    try {
      var p = Process.GetProcessById((int)pid);
      if (!string.Equals(p.ProcessName, "msedge", StringComparison.OrdinalIgnoreCase)) return false;
      // Si no podemos leer CommandLine, asumimos que si Edge esta al frente en kiosk conviene bloquear.
      return true;
    } catch { return false; }
  }

  private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN)) {
      int vk = Marshal.ReadInt32(lParam);
      bool alt = (Control.ModifierKeys & Keys.Alt) == Keys.Alt;
      bool ctrl = (Control.ModifierKeys & Keys.Control) == Keys.Control;
      // Alt+F4, Ctrl+W, Ctrl+F4, F11 (salir fullscreen), Ctrl+Shift+Esc no se bloquea (personal)
      bool block =
        (alt && vk == (int)Keys.F4) ||
        (ctrl && vk == (int)Keys.W) ||
        (ctrl && vk == (int)Keys.F4) ||
        (vk == (int)Keys.F11) ||
        (vk == (int)Keys.LWin) ||
        (vk == (int)Keys.RWin);
      if (block && KioskEdgeFocused()) {
        return (IntPtr)1;
      }
    }
    return CallNextHookEx(_hook, nCode, wParam, lParam);
  }

  public void Dispose() {
    if (_hook != IntPtr.Zero) UnhookWindowsHookEx(_hook);
  }

  private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);
  [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hhk);
  [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
  [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string lpModuleName);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@ -ReferencedAssemblies System.Windows.Forms

Write-Host "Proteccion kiosk activa."
Write-Host "- Bloquea Alt+F4, Ctrl+W, F11 y tecla Windows si Edge kiosk esta al frente."
Write-Host "- Para apagar proteccion: cierra esta ventana."
Write-Host "- Para cerrar el kiosk: usa cerrar-kiosk-personal.bat en la Dell."

$blocker = New-Object KioskKeyBlock $profile
try {
  while ($true) {
    $alive = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object {
      $_.CommandLine -and $_.CommandLine -like ("*" + $profile + "*")
    }
    if (-not $alive) {
      Write-Host "No hay Edge kiosk. Sigo esperando... (Ctrl+C para salir)"
    }
    Start-Sleep -Seconds 3
    [System.Windows.Forms.Application]::DoEvents()
  }
} finally {
  $blocker.Dispose()
}
