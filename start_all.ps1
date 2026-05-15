# ================================
# CHATT — START ALL SERVICES (FINAL)
# Starts: Realtime(50505), Orchestrator(50506), STT(50507), Frontend(5173)
#         Manual backend(50605), Manual frontend(5174)
# ================================

$ErrorActionPreference = "Stop"

Write-Host "Starting CHATT system (ALL services)..." -ForegroundColor Cyan

# --- Root paths ---
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND      = Join-Path $PROJECT_ROOT "backend"
$FRONTEND     = Join-Path $PROJECT_ROOT "frontend"
$MAN_BACKEND  = Join-Path $PROJECT_ROOT "manual-backend"
$MAN_FRONTEND = Join-Path $PROJECT_ROOT "manual-frontend"
$VENV_ACT     = Join-Path $BACKEND ".venv\Scripts\Activate.ps1"

# --- Safety checks ---
if (!(Test-Path $BACKEND))      { throw "Missing folder: $BACKEND" }
if (!(Test-Path $FRONTEND))     { throw "Missing folder: $FRONTEND" }
if (!(Test-Path $MAN_BACKEND))  { throw "Missing folder: $MAN_BACKEND" }
if (!(Test-Path $MAN_FRONTEND)) { throw "Missing folder: $MAN_FRONTEND" }
if (!(Test-Path $VENV_ACT))     { throw "ERROR: backend\.venv not found. Create venv in backend\.venv first." }

function Start-ServiceWindow {
    param(
        [Parameter(Mandatory=$true)][string]$Title,
        [Parameter(Mandatory=$true)][string]$WorkDir,
        [Parameter(Mandatory=$true)][string]$Command
    )

    # Open new PowerShell window; set title; cd; run command
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "try { `$host.ui.RawUI.WindowTitle = '$Title'; cd '$WorkDir'; $Command } catch { Write-Host `$_ -ForegroundColor Red; pause }"
    ) | Out-Null
}

# ----------------
# Python services (shared backend venv)
# ----------------

Start-ServiceWindow `
  -Title "CHATT | Realtime (50505)" `
  -WorkDir $BACKEND `
  -Command ". '$VENV_ACT'; python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info"

Start-Sleep -Seconds 1

Start-ServiceWindow `
  -Title "CHATT | Orchestrator (50506)" `
  -WorkDir $BACKEND `
  -Command ". '$VENV_ACT'; python -m uvicorn orchestrator.server:app --host 127.0.0.1 --port 50506 --log-level info"

Start-Sleep -Seconds 1

Start-ServiceWindow `
  -Title "CHATT | STT (50507)" `
  -WorkDir $BACKEND `
  -Command ". '$VENV_ACT'; python -m uvicorn speech_server:app --host 127.0.0.1 --port 50507 --log-level info"

Start-Sleep -Seconds 1

# Manual backend uses the SAME backend venv (intentionally)
Start-ServiceWindow `
  -Title "CHATT | Manual backend (50605)" `
  -WorkDir $MAN_BACKEND `
  -Command ". '$VENV_ACT'; python -m uvicorn app_manual:app --host 127.0.0.1 --port 50605 --log-level info"

Start-Sleep -Seconds 1

# ----------------
# Node frontends
# ----------------

Start-ServiceWindow `
  -Title "CHATT | Frontend (5173)" `
  -WorkDir $FRONTEND `
  -Command "npm run dev"

Start-Sleep -Seconds 1

Start-ServiceWindow `
  -Title "CHATT | Manual frontend (5174)" `
  -WorkDir $MAN_FRONTEND `
  -Command "npm run dev -- --port 5174"

Write-Host "All CHATT services started (including MANUAL)." -ForegroundColor Green
Write-Host "Main UI:    http://localhost:5173" -ForegroundColor Green
Write-Host "Manual UI:  http://localhost:5174" -ForegroundColor Green
Write-Host "Orchestrator: http://127.0.0.1:50506" -ForegroundColor Green
Write-Host "STT:         http://127.0.0.1:50507" -ForegroundColor Green
Write-Host "Realtime:    http://127.0.0.1:50505" -ForegroundColor Green
Write-Host "Manual BE:   http://127.0.0.1:50605" -ForegroundColor Green
