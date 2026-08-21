# tray-quit.ps1 — 托盘「退出 Companion」自动化（正常退出验收）
# 枚举通知区按钮逐个右键，UIA 匹配「退出 Companion」菜单项并 Invoke。
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class TrayNative {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
}
'@

$tray = [TrayNative]::FindWindow('Shell_TrayWnd', $null)
$notify = [TrayNative]::FindWindowEx($tray, [IntPtr]::Zero, 'TrayNotifyWnd', $null)
$toolbar = [TrayNative]::FindWindowEx($notify, [IntPtr]::Zero, 'ToolbarWindow32', $null)
if ($toolbar -eq [IntPtr]::Zero) { Write-Output 'FAIL: toolbar not found'; exit 1 }

$TB_BUTTONCOUNT = 0x418
$TB_GETITEMRECT = 0x41D
$count = [TrayNative]::SendMessage($toolbar, $TB_BUTTONCOUNT, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "tray buttons: $count"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

function Find-QuitMenu {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::MenuItem)
  $items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  foreach ($item in $items) { if ($item.Current.Name -eq '退出 Companion') { return $item } }
  return $null
}

$hit = $false
for ($i = 0; $i -lt [int]$count; $i++) {
  $btnRect = New-Object TrayNative+RECT
  $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(16)
  try {
    [System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 0, 0); [System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 4, 0)
    [System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 8, 0); [System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 12, 0)
    [void][TrayNative]::SendMessage($toolbar, $TB_GETITEMRECT, [IntPtr]$i, $ptr)
    $btnRect.L = [System.Runtime.InteropServices.Marshal]::ReadInt32($ptr, 0); $btnRect.T = [System.Runtime.InteropServices.Marshal]::ReadInt32($ptr, 4)
    $btnRect.R = [System.Runtime.InteropServices.Marshal]::ReadInt32($ptr, 8); $btnRect.B = [System.Runtime.InteropServices.Marshal]::ReadInt32($ptr, 12)
  } finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr) }
  if ($btnRect.R -le $btnRect.L) { continue }
  $cx = [int](($btnRect.L + $btnRect.R) / 2); $cy = [int](($btnRect.T + $btnRect.B) / 2)
  [void][TrayNative]::SetCursorPos($cx, $cy)
  Start-Sleep -Milliseconds 150
  [TrayNative]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [TrayNative]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 500
  $quit = Find-QuitMenu
  if ($null -ne $quit) {
    $quit.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Write-Output "OK: quit invoked via button $i"
    $hit = $true
    break
  }
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  Start-Sleep -Milliseconds 200
}
if (-not $hit) { Write-Output 'FAIL: quit menu item not found on any tray button'; exit 1 }
