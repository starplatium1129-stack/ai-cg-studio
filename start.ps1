# AI-CG-Studio launcher
# Usage: double-click control.bat

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  AI-CG-Studio" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor DarkGray
Write-Host ""

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  Node.js: $(node --version)" -ForegroundColor DarkGray

# 2. Install deps
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
        Read-Host "  Press Enter to exit"
        exit 1
    }
}

# 3. Build SPA if needed
if (-not (Test-Path "dist\index.html")) {
    Write-Host "  Building Vue SPA..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Build failed" -ForegroundColor Red
        Read-Host "  Press Enter to exit"
        exit 1
    }
}

# 4. Kill existing process on port 3000
# NOTE: $pid is reserved in PowerShell - use $ownPid instead
$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $ownPids = $existing | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($ownPid in $ownPids) {
        try {
            $proc = Get-Process -Id $ownPid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Stopping old process: $($proc.Name) (PID $ownPid)" -ForegroundColor Yellow
                Stop-Process -Id $ownPid -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 600
}

# 5. Open browser after delay (cmd /c avoids PS job issues)
cmd /c "start /min cmd /c timeout /t 2 /nobreak >nul ^&^& start http://127.0.0.1:3000/control" 2>$null

# 6. Start server
Write-Host "  Control panel : http://127.0.0.1:3000/control" -ForegroundColor Green
Write-Host "  Local site    : http://127.0.0.1:3000/" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

node server.js

Write-Host ""
Write-Host "  Server stopped." -ForegroundColor DarkGray
Read-Host "  Press Enter to close"
