@echo off
title AI-CG-Studio Control Panel
cd /d "%~dp0"

:: Check node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    pause
    exit /b
)

:: Install deps if needed
if not exist "node_modules" (
    echo  Installing dependencies...
    call npm install
    echo.
)

:: Start control server
node tools\control-server.js
pause
