@echo off
title AI-CG-Studio Control Panel
cd /d "%~dp0"

:: Check node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Install deps if needed
if not exist "node_modules" (
    echo  Installing dependencies...
    call npm install
    echo.
)

:: Build SPA if dist/ is missing
if not exist "dist\index.html" (
    echo  Building Vue SPA...
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Build failed. Check errors above.
        pause
        exit /b 1
    )
    echo.
)

:: Kill any process already using port 3000
echo  Checking port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo  Stopping previous instance (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Start main gateway
echo  Starting gateway...
echo  Control panel: http://127.0.0.1:3000/control
echo  Local site:    http://127.0.0.1:3000/
echo.

:: Open control panel in default browser after 2s
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:3000/control"

node server.js
pause
