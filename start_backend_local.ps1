# ================================
# CHATT - START LOCAL BACKEND ONLY
# Starts: Realtime/TTS (50505), Orchestrator (50506), STT (50507)
# ================================

$ErrorActionPreference = "Stop"

Write-Host "Starting CHATT local backend services..." -ForegroundColor Cyan

$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $PROJECT_ROOT "backend"
$VENV_ACT = Join-Path $BACKEND ".venv\Scripts\Activate.ps1"

if (!(Test-Path $BACKEND)) {
    throw "Missing backend folder: $BACKEND"
}

if (!(Test-Path $VENV_ACT)) {
    throw "Missing backend venv activation script: $VENV_ACT"
}

function Start-BackendService {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)][int]$Port,
        [Parameter(Mandatory=$true)][string]$Command
    )

    Write-Host "Starting $Name on port $Port..." -ForegroundColor Cyan

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "try { `$host.ui.RawUI.WindowTitle = 'CHATT | $Name ($Port)'; cd '$BACKEND'; . '$VENV_ACT'; $Command } catch { Write-Host `$_ -ForegroundColor Red; pause }"
    ) | Out-Null
}

Start-BackendService `
    -Name "Realtime/TTS backend" `
    -Port 50505 `
    -Command "python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info"

Start-Sleep -Seconds 1

Start-BackendService `
    -Name "Orchestrator" `
    -Port 50506 `
    -Command "python -m uvicorn orchestrator.server:app --host 127.0.0.1 --port 50506 --log-level info"

Start-Sleep -Seconds 1

Start-BackendService `
    -Name "STT" `
    -Port 50507 `
    -Command "python -m uvicorn speech_server:app --host 127.0.0.1 --port 50507 --log-level info"

Write-Host "CHATT local backend startup requested." -ForegroundColor Green
Write-Host "Realtime/TTS: http://127.0.0.1:50505" -ForegroundColor Green
Write-Host "Orchestrator: http://127.0.0.1:50506" -ForegroundColor Green
Write-Host "STT:          ws://127.0.0.1:50507/stt/ws/{sessionId}" -ForegroundColor Green
