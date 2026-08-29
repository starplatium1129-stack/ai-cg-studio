@echo off
chcp 65001 >nul
echo === AI-CG-Studio 桌面端部署 ===
echo.
echo 默认：增量部署（清理历史残留 + 复制最新代码 + 清缓存 + 验证反推依赖 + 重启）
echo.
echo 可选参数（可直接追加在本文件名后面）：
echo   -SkipBuild 跳过前端构建      -Cleanup 清理历史残留（默认已带）
echo   -UseInstaller 用完整安装包   -NoRestart 部署后不启动
echo.
echo 例：deploy-desktop.bat -UseInstaller -NoRestart
echo.
echo 若弹出 UAC 窗口，请点「是」。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\maintenance\deploy-desktop-quick.ps1" -Cleanup %*
echo.
echo === 结束（exit=%ERRORLEVEL%），请查看提权窗口的输出 ===
pause
