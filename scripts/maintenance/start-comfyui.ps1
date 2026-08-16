# AI-CG-Studio ComfyUI launcher (2026-08-17)
# Restart ComfyUI with DynamicVRAM (comfy-aimdo) DISABLED.
#
# WHY: comfy-aimdo DynamicVRAM crashes on big weight transfers (H3 15s video,
# 20GB staged on a 16GB card) - task hangs at 99% GPU with no progress and the
# HTTP server eventually dies ("Accept failed"). See docs/comfyui-dynamic-vram-crash.md.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/maintenance/start-comfyui.ps1
# Logs:  E:\code\2\lora\AI\ComfyUI\user\comfyui-run.log / comfyui-run.err.log

$ErrorActionPreference = 'Stop'
$comfyRoot = 'E:\code\2\lora\AI\ComfyUI'
$python = 'C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe'
$logDir = Join-Path $comfyRoot 'user'

# Do not start a second instance while one is healthy.
$existing = Get-NetTCPConnection -LocalPort 8188 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "ComfyUI already listening on 8188 (pid $($existing.OwningProcess)) - nothing to do."
  exit 0
}

Write-Host 'Starting ComfyUI (dynamic VRAM disabled)...'
$out = Join-Path $logDir 'comfyui-run.log'
$err = Join-Path $logDir 'comfyui-run.err.log'
$proc = Start-Process -FilePath $python -ArgumentList @(
  '-u',
  (Join-Path $comfyRoot 'main.py'),
  '--listen', '127.0.0.1',
  '--port', '8188',
  '--disable-pinned-memory',
  '--disable-dynamic-vram'
) -WorkingDirectory $comfyRoot -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru

Write-Host "ComfyUI launched (pid $($proc.Id)); waiting for health check..."
$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 2
  $listener = Get-NetTCPConnection -LocalPort 8188 -State Listen -ErrorAction SilentlyContinue
} while (-not $listener -and (Get-Date) -lt $deadline)

if (-not $listener) {
  Write-Host 'ComfyUI failed to start - see logs below:'
  Get-Content $err -Tail 20 -ErrorAction SilentlyContinue
  exit 1
}
Write-Host "ComfyUI is up (pid $($listener.OwningProcess)) at http://127.0.0.1:8188"
