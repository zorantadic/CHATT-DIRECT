# ================================
# CHATT - START DIRECT REALTIME
# Starts: Realtime(50505)
# ================================

$ErrorActionPreference = "Stop"

Write-Host "Starting CHATT Direct Realtime..." -ForegroundColor Cyan

# --- Root paths ---
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND      = Join-Path $PROJECT_ROOT "backend"
$VENV_ACT     = Join-Path $BACKEND ".venv\Scripts\Activate.ps1"

# --- Safety checks ---
if (!(Test-Path $BACKEND))      { throw "Missing folder: $BACKEND" }
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
# Realtime backend
# ----------------

Start-ServiceWindow `
  -Title "CHATT | Realtime (50505)" `
  -WorkDir $BACKEND `
  -Command ". '$VENV_ACT'; python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info"

Write-Host "CHATT Direct Realtime started." -ForegroundColor Green
Write-Host "Realtime: http://127.0.0.1:50505" -ForegroundColor Green
