@echo off
title AI-CG-Studio Shutdown
cd /d "%~dp0"
node tools\stop-gateway.js
pause
