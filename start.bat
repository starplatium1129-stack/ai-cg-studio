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

:: Save token to file for show-url.bat
echo %TOKEN%>"%~dp0.gateway_token"

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
:: Log tunnel output to file so show-url.bat can read the domain
start "AI-CG-Tunnel" cmd /c ""%CF%" tunnel --url http://localhost:3000 > "%~dp0tunnel.log" 2>&1"
echo         Waiting for tunnel domain (~10s)...
timeout /t 12 >nul

echo  [4/4] Done!
echo.
echo  ==============================================
echo   Two windows are now open:
echo     AI-CG-Server   (gateway)
echo     AI-CG-Tunnel   (tunnel)
echo.
echo   To stop: run stop.bat  or  Ctrl+C in each window
echo  ==============================================
echo.

:: Auto-extract and display the share link
echo  --- Your Share Link ---
echo.
setlocal enabledelayedexpansion
set "DOMAIN="
for /f "tokens=*" %%a in ('findstr /i "trycloudflare.com" "%~dp0tunnel.log" 2^>nul') do (
    set "LINE=%%a"
)
for /f "tokens=*" %%u in ('echo !LINE! ^| findstr /i "https://.*trycloudflare.com"') do (
    set "DOMAIN=%%u"
)
for /f "tokens=*" %%v in ("!DOMAIN!") do set "DOMAIN=%%v"

if "!DOMAIN!"=="" (
    echo   (Tunnel URL not ready yet - run show-url.bat in a moment)
) else (
    echo   !DOMAIN!?token=!TOKEN!
)
echo.
endlocal
pause
