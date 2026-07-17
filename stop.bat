@echo off
chcp 65001 >nul

echo.
echo  ──────────────────────────────────────────
echo   关闭 AI-CG-Studio 联机网关
echo  ──────────────────────────────────────────
echo.

echo  [1/2] 关闭 node server...
taskkill /fi "WINDOWTITLE eq AI-CG-Server*" /f >nul 2>&1
taskkill /fi "IMAGENAME eq node.exe" /f >nul 2>&1
echo        Done.

echo  [2/2] 关闭 cloudflared...
taskkill /fi "WINDOWTITLE eq AI-CG-Tunnel*" /f >nul 2>&1
taskkill /fi "IMAGENAME eq cloudflared.exe" /f >nul 2>&1
echo        Done.

echo.
echo  已全部关闭。
echo  ──────────────────────────────────────────
echo.
pause
