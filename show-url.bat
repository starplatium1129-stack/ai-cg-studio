@echo off
title AI-CG-Studio - Share Link

:: Read token
set "TOKEN="
if exist "%~dp0.gateway_token" set /p TOKEN=<"%~dp0.gateway_token"

:: Extract tunnel domain
for /f "delims=" %%v in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\extract-tunnel-url.ps1" -LogPath "%~dp0tunnel.log"') do set "DOMAIN=%%v"

if "%DOMAIN%"=="" (
    echo.
    echo   Tunnel URL not found. Run start.bat first.
    echo.
    pause
    exit /b
)
if "%DOMAIN%"=="URL_NOT_FOUND" (
    echo.
    echo   Tunnel URL not found. Run start.bat first.
    echo.
    pause
    exit /b
)

echo.
echo  ==============================================
echo   Share this link with your friend:
echo  ==============================================
echo.
echo   %DOMAIN%?token=%TOKEN%
echo.
echo  ==============================================
echo.
pause
