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

:: Start control server (open http://127.0.0.1:3001 to manage services)
echo  Starting control panel...
echo  Open http://127.0.0.1:3001 to manage SD WebUI, GPT-SoVITS and sharing.
echo.
node tools\control-server.js
pause
