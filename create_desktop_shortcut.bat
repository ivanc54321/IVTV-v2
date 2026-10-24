@echo off
cd /d "%~dp0"
echo Creating Desktop Shortcuts for IV - TV...
cscript //nologo "%~dp0create_desktop_shortcut.vbs"
echo Done!
pause
