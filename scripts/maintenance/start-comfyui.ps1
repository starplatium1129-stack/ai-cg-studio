# AI-CG-Studio ComfyUI launcher (2026-08-17, v2)
# Starts ComfyUI with the VERIFIED STABLE combo:
#   ComfyUI b1693ec (v0.30.0, 2026-08-02) + comfy-aimdo 0.4.8 + DynamicVRAM.
#
# WHY THIS COMBO:
# - comfy-aimdo 0.4.13 (and the 8-07 ComfyUI) hangs forever while unloading a
#   resident model and loading the 20GB H3 main model (Anima -> H3 switch) -
#   GPU pegged at 99%, no progress, HTTP server eventually dies. Reproduced 4x,
#   matches Comfy-Org/ComfyUI issue #15255 (regression after Aug 3 2026 update).
# - Rolling ComfyUI back to 8-02 (b1693ec) AND comfy-aimdo back to 0.4.8 makes
#   the full Anima-draw -> H3 15s-video pipeline run end to end (583s measured).
# - Do NOT add --disable-dynamic-vram (traditional mode is slow) and do NOT add
#   --disable-pinned-memory (was present before, not the culprit, but defaults
#   are the verified baseline).
#
# NOTE: a venv python.exe appears as TWO processes (venv launcher + base
# interpreter) - that is ONE instance, not two. Never kill just one of them.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/maintenance/start-comfyui.ps1
# Logs:  E:\code\2\lora\AI\ComfyUI\user\comfyui-run.log / comfyui-run.err.log

$ErrorActionPreference = 'Stop'
$comfyRoot = 'E:\code\2\lora\AI\ComfyUI'
$python = Join-Path $comfyRoot 'venv\Scripts\python.exe'
$logDir = Join-Path $comfyRoot 'user'

if (-not (Test-Path $python)) {
  Write-Host "venv python not found: $python"
  exit 1
}

# Do not start a second instance while one is healthy.
$existing = Get-NetTCPConnection -LocalPort 8188 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "ComfyUI already listening on 8188 (pid $($existing.OwningProcess)) - nothing to do."
  exit 0
}

Write-Host 'Starting ComfyUI (stable combo: b1693ec + aimdo 0.4.8 + DynamicVRAM)...'
$out = Join-Path $logDir 'comfyui-run.log'
$err = Join-Path $logDir 'comfyui-run.err.log'
Start-Process -FilePath $python -ArgumentList @(
  '-u',
  (Join-Path $comfyRoot 'main.py'),
  '--listen', '127.0.0.1',
  '--port', '8188'
) -WorkingDirectory $comfyRoot -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden

Write-Host 'Waiting for health check...'
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
