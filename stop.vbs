Set oShell = CreateObject("WScript.Shell")
oShell.Run "powershell -NoProfile -Command ""$c = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } }""", 0, True
