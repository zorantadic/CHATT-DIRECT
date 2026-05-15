PROJECT SETUP – QUICK RECOVERY

1. Open VS Code
2. Open folder: chatt
3. Open Terminal
4. cd backend

IF .venv EXISTS:
   .venv\Scripts\Activate.ps1

IF .venv DOES NOT EXIST:
   Use Python 3.11
   Create venv:
   python -m venv .venv
   Activate:
   .venv\Scripts\Activate.ps1
   Install deps:
   pip install -r requirements.txt

Verify:
   python --version  -> must be 3.11.x

Start services:
   python -m uvicorn orchestrator.server:app --port 50506
   python -m uvicorn speech_server:app --port 50507
   python -m uvicorn app_realtime:app --port 50505
