@echo off
setlocal
echo Creating dated restore point...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_restore_point.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo Done!
) else (
    echo.
    echo An error occurred while creating the restore point.
)
timeout /t 5
