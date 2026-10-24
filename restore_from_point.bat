@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore_from_point.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo Done!
) else (
    echo.
    echo Restore operation was cancelled or encountered an issue.
)
pause
