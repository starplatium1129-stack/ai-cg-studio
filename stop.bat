@echo off
title AI-CG-Studio Shutdown

echo.
echo  ==============================================
echo   AI-CG-Studio Gateway  --  Stop All
echo  ==============================================
echo.

echo  [1/2] Stopping node server...
taskkill /fi "WINDOWTITLE eq AI-CG-Server*" /f >nul 2>&1
taskkill /fi "IMAGENAME eq node.exe" /f >nul 2>&1
echo        Done.

echo  [2/2] Stopping cloudflared...
taskkill /fi "WINDOWTITLE eq AI-CG-Tunnel*" /f >nul 2>&1
taskkill /fi "IMAGENAME eq cloudflared.exe" /f >nul 2>&1
echo        Done.

echo.
echo  All processes stopped.
echo  ==============================================
echo.
pause
