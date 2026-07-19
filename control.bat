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

:: Start the optional local GPT-SoVITS service when it is installed beside this project
set "VOICE_SCRIPT=%~dp0..\AI\Voice\Start-Voice.ps1"
if exist "%VOICE_SCRIPT%" (
    echo  Checking local voice service...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%VOICE_SCRIPT%"
    if errorlevel 1 echo  [WARN] Voice service failed to start. You can still use the website without AI voice.
    echo.
)

:: Start control server
node tools\control-server.js
pause
