# AI-CG-Studio desktop quick deploy (incremental)
# Copies fresh dist/data/assets into the installed gateway dir and restarts the app.
# Full repackaging (Rust shell / server.js changes) still needs:
#   npm run build:tauri && npm run package:tauri + installer.
#
# Usage (non-admin is fine; UAC prompt auto-raises):
#   powershell -ExecutionPolicy Bypass -File scripts/maintenance/deploy-desktop-quick.ps1 [-SkipBuild] [-NoRestart]
param(
  [switch]$SkipBuild,
  [switch]$NoRestart
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$installDir = 'C:\Program Files\AI-CG-Studio'
$gatewayDir = Join-Path $installDir 'gateway'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Need admin rights - raising UAC...' -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
  exit 0
}

if (-not (Test-Path $gatewayDir)) { Write-Error "Installed dir not found: $gatewayDir (run full installer first)"; exit 1 }

if (-not $SkipBuild) {
  Write-Host '[1/4] npm run build ...' -ForegroundColor Cyan
  Push-Location $root
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error 'build failed'; exit 1 }
  Pop-Location
}

$appProcs = Get-Process -Name 'ai-cg-studio-desktop' -ErrorAction SilentlyContinue
$sidecar = Get-NetTCPConnection -LocalPort 3123 -State Listen -ErrorAction SilentlyContinue
if ($appProcs -or $sidecar) {
  Write-Host '[2/4] Stopping running app...' -ForegroundColor Cyan
  $appProcs | Stop-Process -Force -ErrorAction SilentlyContinue
  if ($sidecar) { Stop-Process -Id $sidecar.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

Write-Host '[3/4] Copying dist/data/assets...' -ForegroundColor Cyan
$map = @(
  @{ src = 'dist';   dst = 'dist' },
  @{ src = 'data';   dst = 'data' },
  @{ src = 'assets'; dst = 'assets' }
)
foreach ($item in $map) {
  $src = Join-Path $root $item.src
  $dst = Join-Path $gatewayDir $item.dst
  if (Test-Path $src) {
    Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
    Write-Host "  copied $($item.src) -> gateway/$($item.dst)" -ForegroundColor DarkGray
  }
}

if (-not $NoRestart) {
  Write-Host '[4/4] Starting app...' -ForegroundColor Cyan
  Start-Process (Join-Path $installDir 'ai-cg-studio-desktop.exe')
}
Write-Host 'Quick deploy done (no installer rebuild).' -ForegroundColor Green
