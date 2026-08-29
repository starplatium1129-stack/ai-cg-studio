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

# Copy order matters (regression 2026-08-15): data must land BEFORE dist.
# The client requests /data/*.json with ?v=DATA_VERSION; if a new dist (new
# version number) ever serves against the old data, WebView2 caches the stale
# body under the new URL with an immutable one-year header and never refreshes.
# data-first guarantees a version number only ever points at matching content.
#
# 聚合产物自 2026-08-28 起不入库（源 = data/scenes/ 与 data/popular/ 分片），
# 且网关安装目录不含 scripts/（无法启动自愈），所以拷贝前必须先把产物构建新鲜。
Write-Host '[3/4] Refreshing data products + copying data/dist/assets...' -ForegroundColor Cyan
node (Join-Path $root 'scripts\maintenance\build-scenes.js')
if ($LASTEXITCODE -ne 0) { throw 'build-scenes failed - aborting deploy' }
node (Join-Path $root 'scripts\maintenance\build-popular.js')
if ($LASTEXITCODE -ne 0) { throw 'build-popular failed - aborting deploy' }
$map = @(
  @{ src = 'data';     dst = 'data' },
  @{ src = 'dist';     dst = 'dist' },
  @{ src = 'assets';   dst = 'assets' },
  @{ src = 'routes';   dst = 'routes' },
  @{ src = 'server';   dst = 'server' },
  @{ src = 'services'; dst = 'services' },
  # scripts/lib 是 server/config.js、tunnel.js 与 routes/maintenance.js 的运行时依赖
  # （runtime-paths / scene-store），网关安装目录没有 scripts/，必须随增量同步。
  @{ src = 'scripts/lib'; dst = 'scripts/lib' }
)
foreach ($item in $map) {
  $src = Join-Path $root $item.src
  $dst = Join-Path $gatewayDir $item.dst
  if (Test-Path $src) {
    Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
    Write-Host "  copied $($item.src) -> gateway/$($item.dst)" -ForegroundColor DarkGray
  }
}
$serverJsSrc = Join-Path $root 'server.js'
if (Test-Path $serverJsSrc) {
  Copy-Item -Path $serverJsSrc -Destination (Join-Path $gatewayDir 'server.js') -Force
  Write-Host "  copied server.js -> gateway/server.js" -ForegroundColor DarkGray
}

# Copy-Item merges, so hashed build assets under dist/_app accumulate forever
# (21 stale CompanionView chunks observed on 2026-08-16). Prune files that are
# not present in the fresh build; content-hashed names make same-name files
# identical, so this only removes truly dead chunks. Tabs still holding an old
# index.html may 404 a lazy chunk until reloaded - acceptable for a local app.
$newApp = Join-Path $root 'dist\_app'
$dstApp = Join-Path $gatewayDir 'dist\_app'
if ((Test-Path $newApp) -and (Test-Path $dstApp)) {
  $keep = @(Get-ChildItem -File $newApp | ForEach-Object { $_.Name })
  $stale = @(Get-ChildItem -File $dstApp | Where-Object { $keep -notcontains $_.Name })
  if ($stale.Count -gt 0) {
    $stale | ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
    Write-Host "  pruned $($stale.Count) stale hashed asset(s) from dist/_app" -ForegroundColor DarkGray
  }
}

# Defense in depth: clear WebView2 HTTP caches (Cache / Code Cache / GPUCache).
# Even with data-first ordering, an immutable entry cached in a previous
# broken window would keep shadowing the new data; caches are performance-only
# and contain no user data (IndexedDB / Local Storage are untouched).
$webviewBase = Join-Path $env:LOCALAPPDATA 'com.aics.studio\EBWebView\Default'
foreach ($cacheDir in @('Cache', 'Code Cache', 'GPUCache')) {
  $target = Join-Path $webviewBase $cacheDir
  if (Test-Path $target) {
    Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  cleared WebView2 $cacheDir" -ForegroundColor DarkGray
  }
}

if (-not $NoRestart) {
  Write-Host '[4/4] Starting app...' -ForegroundColor Cyan
  Start-Process (Join-Path $installDir 'ai-cg-studio-desktop.exe')
}
Write-Host 'Quick deploy done (no installer rebuild).' -ForegroundColor Green
