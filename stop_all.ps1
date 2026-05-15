# ================================
# CHATT – STOP ALL SERVICES
# ================================

Write-Host "Stopping CHATT services..." -ForegroundColor Yellow

# --- Ports used by CHATT ---
$PORTS = @(50505, 50506, 50507, 50605, 5173, 5174)

foreach ($port in $PORTS) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
               Select-Object -First 1 |
               ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }

    if ($process) {
        Write-Host "Stopping process on port $port (PID $($process.Id))"
        Stop-Process -Id $process.Id -Force
    }
}

Write-Host "All CHATT services stopped." -ForegroundColor Green
