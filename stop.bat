@echo off
title AI-CG-Studio Shutdown

echo.
echo  ==============================================
echo   AI-CG-Studio Gateway  --  Stop
echo  ==============================================
echo.

cd /d "%~dp0"

echo  [1/2] Stopping node server...
if exist ".gateway_pid" (
    set /p PID=<".gateway_pid"
    taskkill /pid %PID% /f >nul 2>&1
    del ".gateway_pid" >nul 2>&1
    echo        Done (PID %PID%)
) else (
    echo        PID file not found, skipping.
)

echo  [2/2] Stopping cloudflared...
if exist ".tunnel_pid" (
    set /p PID=<".tunnel_pid"
    taskkill /pid %PID% /f >nul 2>&1
    del ".tunnel_pid" >nul 2>&1
    echo        Done (PID %PID%)
) else (
    echo        PID file not found, skipping.
)

echo.
echo  All done.
echo  ==============================================
echo.
pause
