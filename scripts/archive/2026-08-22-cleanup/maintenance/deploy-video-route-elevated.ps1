# AI-CG-Studio elevated deploy: routes/video.js + restart desktop (3123)
# Run via: Start-Process powershell -Verb RunAs -ArgumentList ...
param(
  [switch]$SkipRestart
)
$ErrorActionPreference = 'Stop'
$log = 'C:\Users\Administrator\deploy-video-route.log'
function Log($msg) { Add-Content -Path $log -Value ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$gatewayDir = 'C:\Program Files\AI-CG-Studio\gateway'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Log 'NOT ELEVATED - re-raising...'
  Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`""
  exit 0
}
Log "elevated ok (user: $env:USERNAME)"

# 1. copy fresh routes/video.js
$src = Join-Path $root 'routes\video.js'
$dst = Join-Path $gatewayDir 'routes\video.js'
Copy-Item -Path $src -Destination $dst -Force
Log "copied video.js -> $dst"

# 2. stop desktop + sidecar
$appProcs = Get-Process -Name 'ai-cg-studio-desktop' -ErrorAction SilentlyContinue
$sidecar = Get-NetTCPConnection -LocalPort 3123 -State Listen -ErrorAction SilentlyContinue
if ($appProcs) { $appProcs | Stop-Process -Force -ErrorAction SilentlyContinue; Log "stopped desktop ($($appProcs.Count) proc)" }
if ($sidecar) { Stop-Process -Id $sidecar.OwningProcess -Force -ErrorAction SilentlyContinue; Log "stopped sidecar pid $($sidecar.OwningProcess)" }
Start-Sleep -Seconds 3

if (-not $SkipRestart) {
  Start-Process (Join-Path 'C:\Program Files\AI-CG-Studio' 'ai-cg-studio-desktop.exe')
  Log 'started desktop app'
}
Log 'deploy done'
