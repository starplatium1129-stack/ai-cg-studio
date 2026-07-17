@echo off
chcp 65001 >nul
title AI-CG-Studio 联机网关

echo.
echo  ──────────────────────────────────────────
echo   AI-CG-Studio 联机网关 一键启动
echo  ──────────────────────────────────────────
echo.

cd /d "%~dp0"

:: 检查 node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未找到 Node.js，请先安装
    pause
    exit /b
)

:: 检查依赖
if not exist "node_modules" (
    echo  [1/4] 首次运行，安装依赖...
    call npm install
    echo.
)

:: 检查 cloudflared
set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CF%" (
    echo  [错误] 未找到 cloudflared，请先安装 MSI
    pause
    exit /b
)

:: 生成 token（server.js 会读取 TOKEN 环境变量，两边一致）
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"') do set TOKEN=%%i

:: 检查 SD WebUI
echo  [1/4] 检查 SD WebUI...
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:7860/sdapi/v1/sd-models >%temp%\sd_check.txt 2>&1
set /p SD_STATUS=<%temp%\sd_check.txt
if "%SD_STATUS%"=="200" (
    echo         SD WebUI 已在线 [OK]
) else (
    echo         SD WebUI 未检测到 -- 请确认已启动 ReForge 并加了 --api 参数
    echo         继续启动网关（出图功能暂不可用）...
)
echo.

:: 启动网关（传 TOKEN 环境变量）
echo  [2/4] 启动网关 (port 3000)...
start "AI-CG-Server" cmd /c "cd /d "%~dp0" && set TOKEN=%TOKEN% && node server.js"
timeout /t 2 >nul

echo         Token: %TOKEN%
echo         本地: http://localhost:3000/?token=%TOKEN%
echo.

:: 启动穿透
echo  [3/4] 启动 Cloudflare Tunnel...
start "AI-CG-Tunnel" cmd /c ""%CF%" tunnel --url http://localhost:3000"
echo         等待域名分配（约 10 秒）...
timeout /t 12 >nul

echo  [4/4] 完成！
echo.
echo  ──────────────────────────────────────────
echo   两个窗口已打开:
echo     AI-CG-Server  (网关)
echo     AI-CG-Tunnel  (穿透)
echo.
echo   Tunnel 域名在 AI-CG-Tunnel 窗口里找:
echo   格式: https://xxx.trycloudflare.com/?token=%TOKEN%
echo.
echo   关闭: 运行 stop.bat，或分别在窗口按 Ctrl+C
echo  ──────────────────────────────────────────
echo.
pause
