@echo off
title AI-CG-Studio - Share Link

for /f "delims=" %%v in ('node "%~dp0tools\get-share-link.js" 2^>nul') do set "LINK=%%v"

if "%LINK%"=="" (
    echo.
    echo   Tunnel URL or token not found.
    echo   Run start.bat first, then try again.
    echo.
    pause
    exit /b
)

echo.
echo  ==============================================
echo   Share this link with your friend:
echo  ==============================================
echo.
echo   %LINK%
echo.
echo  ==============================================
echo.
pause
