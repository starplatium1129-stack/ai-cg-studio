# 绫季绘境 启动脚本
# 双击 control.bat 或在终端运行：powershell -ExecutionPolicy Bypass -File start.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  ══════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  🔗  绫季绘境  启动中" -ForegroundColor Cyan
Write-Host "  ══════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# ── 1. 检查 Node.js ───────────────────────────────────────────────────────────
if (-not (Get-Command node -EA 0)) {
    Write-Host "  [ERROR] 未找到 Node.js，请先安装 https://nodejs.org" -ForegroundColor Red
    Read-Host "  按 Enter 退出"
    exit 1
}

# ── 2. 安装依赖 ───────────────────────────────────────────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Host "  安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] npm install 失败" -ForegroundColor Red
        Read-Host "  按 Enter 退出"
        exit 1
    }
    Write-Host ""
}

# ── 3. 构建 SPA（dist/ 不存在时）─────────────────────────────────────────────
if (-not (Test-Path "dist\index.html")) {
    Write-Host "  构建 Vue SPA..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] 构建失败，详情见上方输出" -ForegroundColor Red
        Read-Host "  按 Enter 退出"
        exit 1
    }
    Write-Host ""
}

# ── 4. 清理 3000 端口已有进程 ────────────────────────────────────────────────
$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -EA 0
if ($existing) {
    $pids = $existing | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            $proc = Get-Process -Id $pid -EA 0
            if ($proc) {
                Write-Host "  停止旧进程：$($proc.Name) (PID $pid)" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -EA 0
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 600
}

# ── 5. 延迟打开浏览器 ────────────────────────────────────────────────────────
$null = Start-Job {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:3000/control"
}

# ── 6. 启动网关 ──────────────────────────────────────────────────────────────
Write-Host "  控制面板：http://127.0.0.1:3000/control" -ForegroundColor Green
Write-Host "  本地网站：http://127.0.0.1:3000/" -ForegroundColor Green
Write-Host "  按 Ctrl+C 停止服务" -ForegroundColor DarkGray
Write-Host ""

try {
    node server.js
} catch {
    Write-Host ""
    Write-Host "  [ERROR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "  服务已停止。" -ForegroundColor DarkGray
Read-Host "  按 Enter 关闭窗口"
