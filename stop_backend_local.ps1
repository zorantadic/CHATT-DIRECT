# ================================
# CHATT - STOP LOCAL BACKEND ONLY
# Stops: Realtime/TTS (50505), Orchestrator (50506), STT (50507)
# ================================

Write-Host "Stopping CHATT local backend services..." -ForegroundColor Yellow

$PORTS = @(50505, 50506, 50507)

foreach ($port in $PORTS) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
               Select-Object -First 1 |
               ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }

    if ($process) {
        Write-Host "Stopping process on port $port (PID $($process.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $process.Id -Force
    } else {
        Write-Host "No process found on port $port." -ForegroundColor DarkGray
    }
}

Write-Host "CHATT local backend services stopped." -ForegroundColor Green
