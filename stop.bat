@echo off
cd /d "%~dp0"
echo ========================================================
echo   Stopping IV TV background server (port 5173)...
echo ========================================================

powershell -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Write-Host 'IV TV server stopped successfully.' -ForegroundColor Green } else { Write-Host 'IV TV server was not running.' -ForegroundColor Yellow }"

timeout /t 2 >nul
exit /b 0
