@echo off
title AI-CG-Studio - Share Link

:: Read token from file
set TOKEN=
if exist "%~dp0.gateway_token" (
    set /p TOKEN=<"%~dp0.gateway_token"
)

:: Extract tunnel domain from log
set DOMAIN=
for /f "tokens=*" %%a in ('findstr /i "trycloudflare.com" "%~dp0tunnel.log" 2^>nul') do (
    set "LINE=%%a"
)

:: Parse the URL from the line
setlocal enabledelayedexpansion
set "URL="
for /f "tokens=*" %%u in ('echo !LINE! ^| findstr /i "https://.*trycloudflare.com"') do (
    set "URL=%%u"
)

if "!URL!"=="" (
    echo.
    echo   Tunnel URL not found yet.
    echo   Wait a few seconds after running start.bat, then try again.
    echo.
    pause
    exit /b
)

:: Trim spaces
for /f "tokens=*" %%v in ("!URL!") do set "URL=%%v"

echo.
echo  ==============================================
echo   Share this link with your friend:
echo  ==============================================
echo.
echo   !URL!?token=!TOKEN!
echo.
echo  ==============================================
echo   Copy the above URL and send it.
echo  ==============================================
echo.
pause
