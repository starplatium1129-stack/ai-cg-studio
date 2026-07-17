@echo off
title AI-CG-Studio Gateway

:: Check node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    pause
    exit /b
)

:: Install deps if needed
cd /d "%~dp0"
if not exist "node_modules" (
    echo  Installing dependencies...
    call npm install
    echo.
)

:: Run the Node.js launcher
node tools\start-gateway.js
pause
