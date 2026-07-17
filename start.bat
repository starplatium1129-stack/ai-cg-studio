@echo off
title AI-CG-Studio Gateway

echo.
echo  ==============================================
echo   AI-CG-Studio Gateway  --  One Click Start
echo  ==============================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    pause
    exit /b
)

if not exist "node_modules" (
    echo  [1/4] Installing dependencies...
    call npm install
    echo.
)

set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CF%" (
    echo  [ERROR] cloudflared not found
    pause
    exit /b
)

for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"') do set TOKEN=%%i

echo  [1/4] Checking SD WebUI...
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:7860/sdapi/v1/sd-models >%temp%\sd_check.txt 2>&1
set /p SD_STATUS=<%temp%\sd_check.txt
if "%SD_STATUS%"=="200" (
    echo         SD WebUI is online [OK]
) else (
    echo         SD WebUI not detected - make sure ReForge is running with --api
    echo         Gateway will start but generation won't work.
)
echo.

echo  [2/4] Starting gateway on port 3000...
start "AI-CG-Server" cmd /c "cd /d "%~dp0" && set TOKEN=%TOKEN% && node server.js"
timeout /t 2 >nul

echo         Token : %TOKEN%
echo         Local : http://localhost:3000/?token=%TOKEN%
echo.

echo  [3/4] Starting Cloudflare Tunnel...
start "AI-CG-Tunnel" cmd /c ""%CF%" tunnel --url http://localhost:3000"
echo         Waiting for tunnel domain (~10s)...
timeout /t 12 >nul

echo  [4/4] Done!
echo.
echo  ==============================================
echo   Two windows are now open:
echo     AI-CG-Server   (gateway)
echo     AI-CG-Tunnel   (tunnel)
echo.
echo   Find the tunnel URL in the AI-CG-Tunnel window.
echo   Format: https://xxx.trycloudflare.com/?token=%TOKEN%
echo.
echo   To stop: run stop.bat  or  Ctrl+C in each window
echo  ==============================================
echo.
pause
