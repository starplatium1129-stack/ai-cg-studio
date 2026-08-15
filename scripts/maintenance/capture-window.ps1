# capture-window.ps1 — 窗口级截图（PrintWindow 截取指定窗口，不截桌面）
# 用法: powershell -File capture-window.ps1 -Title "绫季 Companion" -Out "out.png" [-Pid 1234]
param(
  [string]$Title = '绫季 Companion',
  [string]$Out = '',
  [int]$ProcessId = 0,
  [int]$Scale = 2
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CapWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[void][CapWin]::SetProcessDPIAware()
$hwnd = [IntPtr]::Zero
if ($ProcessId -gt 0) {
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($proc) { $hwnd = $proc.MainWindowHandle }
}
if ($hwnd -eq [IntPtr]::Zero) { $hwnd = [CapWin]::FindWindow($null, $Title) }
if ($hwnd -eq [IntPtr]::Zero) { Write-Error "window not found: $Title (pid=$ProcessId)"; exit 1 }
$rect = New-Object CapWin+RECT
[void][CapWin]::GetWindowRect($hwnd, [ref]$rect)
$w = [int]$rect.R - [int]$rect.L; $h = [int]$rect.B - [int]$rect.T
if ($w -le 0 -or $h -le 0) { Write-Error "empty window rect ${w}x${h}"; exit 1 }
Write-Output "window: $hwnd ${w}x${h} visible=$([CapWin]::IsWindowVisible($hwnd))"
if (-not $Out) { $Out = "window-$w x $h.png" }
Add-Type -AssemblyName System.Drawing
$bw = [int]$w * [int]$Scale
$bh = [int]$h * [int]$Scale
$bmp = New-Object System.Drawing.Bitmap($bw, $bh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.ScaleTransform($Scale, $Scale)
$hdc = $g.GetHdc()
$ok = [CapWin]::PrintWindow($hwnd, $hdc, 2)  # PW_RENDERFULLCONTENT
$g.ReleaseHdc($hdc)
$g.Dispose()
if (-not $ok) { Write-Output "warning: PrintWindow returned false (fallback plain mode)" }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "saved: $Out (${w}x${h} x$Scale)"
