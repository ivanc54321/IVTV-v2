$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$restoreFolder = Join-Path $projectRoot "restore_points"

if (-not (Test-Path $restoreFolder)) {
    New-Item -ItemType Directory -Path $restoreFolder -Force | Out-Null
}

$dateStamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$zipPath = Join-Path $restoreFolder "restore_point_$dateStamp.zip"

Write-Host "Creating restore point: $zipPath..." -ForegroundColor Cyan

$tempFolder = Join-Path $env:TEMP "ivtv_backup_$dateStamp"
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

try {
    Get-ChildItem -Path $projectRoot -Force | Where-Object {
        $_.Name -notin @(".git", "restore_points", "__pycache__", ".venv", "env", "node_modules") -and
        $_.Extension -notin @(".log") -and
        $_.Name -ne "IV-TV-backup.zip"
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $tempFolder $_.Name) -Recurse -Force
    }

    Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -Force
    $sizeMb = [math]::Round(((Get-Item $zipPath).Length / 1MB), 2)
    Write-Host "SUCCESS: Restore point created ($sizeMb MB) at:" -ForegroundColor Green
    Write-Host "  $zipPath" -ForegroundColor Yellow
}
finally {
    if (Test-Path $tempFolder) {
        Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue
    }
}
