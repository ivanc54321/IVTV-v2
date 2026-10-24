$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$restoreFolder = Join-Path $projectRoot "restore_points"

if (-not (Test-Path $restoreFolder)) {
    Write-Host "Error: No restore_points directory found at $restoreFolder" -ForegroundColor Red
    exit 1
}

$restorePoints = Get-ChildItem -Path $restoreFolder -Filter "restore_point_*.zip" | Sort-Object LastWriteTime -Descending

if ($restorePoints.Count -eq 0) {
    Write-Host "No restore points found in $restoreFolder" -ForegroundColor Yellow
    exit 0
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "             IVTV DATED RESTORE POINT MANAGER             " -ForegroundColor Cyan
Write-Host "           Easily Undo Unwanted Code / UI Changes         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available Restore Points:" -ForegroundColor Green

for ($i = 0; $i -lt $restorePoints.Count; $i++) {
    $item = $restorePoints[$i]
    $sizeMb = [math]::Round(($item.Length / 1MB), 2)
    $dateStr = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    $prefix = if ($i -eq 0) { "[1] (LATEST)" } else { "[$($i + 1)]" }
    Write-Host "  $prefix $dateStr  -  $($item.Name)  ($sizeMb MB)"
}

Write-Host ""
$choice = Read-Host "Enter number to restore (Press Enter for [1] LATEST, or 'q' to cancel)"

if ($choice -eq 'q' -or $choice -eq 'Q') {
    Write-Host "Restore cancelled." -ForegroundColor Yellow
    exit 0
}

$selectedIdx = 0
if (-not [string]::IsNullOrWhiteSpace($choice)) {
    if ([int]::TryParse($choice, [ref]$selectedIdx)) {
        $selectedIdx = $selectedIdx - 1
    } else {
        Write-Host "Invalid selection. Cancelled." -ForegroundColor Red
        exit 1
    }
}

if ($selectedIdx -lt 0 -or $selectedIdx -ge $restorePoints.Count) {
    Write-Host "Selected number out of range. Cancelled." -ForegroundColor Red
    exit 1
}

$selectedPoint = $restorePoints[$selectedIdx]
Write-Host ""
Write-Host "Preparing to restore: $($selectedPoint.Name)..." -ForegroundColor Cyan

# 1. Automatically create a safety backup of current state before restoring
Write-Host "Creating an automatic safety backup of current files first..." -ForegroundColor Gray
$preRestoreBackup = & "$projectRoot\create_restore_point.ps1"

$tempFolder = Join-Path $env:TEMP "ivtv_restore_temp_$((Get-Date).Ticks)"
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

try {
    # Extract selected archive into temp folder
    Expand-Archive -Path $selectedPoint.FullName -DestinationPath $tempFolder -Force

    # Overwrite project files with restored files
    Get-ChildItem -Path $tempFolder -Force | ForEach-Object {
        $destPath = Join-Path $projectRoot $_.Name
        Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "SUCCESS: Project successfully restored to:" -ForegroundColor Green
    Write-Host "  $($selectedPoint.Name)" -ForegroundColor Yellow
    Write-Host "Unwanted changes have been completely undone!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
finally {
    if (Test-Path $tempFolder) {
        Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue
    }
}
