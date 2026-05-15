# CHATT — SETUP.md (FINAL)

Ovo je jedini izvor istine za lokalni setup CHATT projekta na Windows.

---

## 1) Struktura projekta (kanonska)

chatt/
- backend/
  - .venv/                         (Python venv – jedan, zajednički za backend servise)
  - app_realtime.py                (Realtime bridge)
  - speech_server.py               (STT server)
  - orchestrator/
    - server.py                    (Orchestrator API + Control WS)
    - agent1_client.py             (Agent1 client)
  - requirements.txt
  - .env                           (tajne i endpointi – lokalno)
- frontend/                        (glavni UI)
- manual-backend/
  - app_manual.py                  (manual backend – nezavisan)
- manual-frontend/
  - src/ManualVoiceChat.tsx        (manual UI – nezavisan)
- start_all.ps1
- stop_all.ps1

---

## 2) Port mapa (NE MIJENJATI bez plana)

GLAVNI SISTEM:
- Realtime backend:      50505
- Orchestrator:          50506
- Speech server STT:     50507
- Frontend (Vite):       5173

MANUAL (NEZAVISNO):
- Manual backend:        50605
- Manual frontend (Vite):5174

---

## 3) Golden rules

1) Backend koristi JEDAN venv: chatt/backend/.venv
2) Python verzija mora biti stabilna (preporuka: 3.11.x)
3) Backend servise pokretati iz chatt/backend (da .env bude učitan)
4) Ne menjati portove nasumično
5) Backup/restore radi se kopiranjem celog chatt/ foldera

---

## 4) .env (obavezno)

Lokacija:
- chatt/backend/.env

Mora sadržati sve varijable koje čitaju:
- backend/app_realtime.py
- backend/speech_server.py
- backend/orchestrator/agent1_client.py

Ako dobiješ KeyError: VAR_NAME:
- ili .env fali / nije u backend folderu
- ili servis nije startovan iz backend foldera
- ili varijabla ne postoji u .env

---

## 5) Standardni start (ručno, bez skripti)

Otvoriti 6 terminala (PowerShell), svaki u svom prozoru.

### Terminal 1 — Realtime (50505)
cd chatt\backend
. .venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info

### Terminal 2 — Orchestrator (50506)
cd chatt\backend
. .venv\Scripts\Activate.ps1
python -m uvicorn orchestrator.server:app --host 127.0.0.1 --port 50506 --log-level info

### Terminal 3 — STT (50507)
cd chatt\backend
. .venv\Scripts\Activate.ps1
python -m uvicorn speech_server:app --host 127.0.0.1 --port 50507 --log-level info

### Terminal 4 — Frontend (5173)
cd chatt\frontend
npm run dev

### Terminal 5 — Manual backend (50605)
cd chatt\manual-backend
(venv je u backend folderu)
cd ..\backend
. .venv\Scripts\Activate.ps1
cd ..\manual-backend
python -m uvicorn app_manual:app --host 127.0.0.1 --port 50605 --log-level info

### Terminal 6 — Manual frontend (5174)
cd chatt\manual-frontend
npm run dev -- --port 5174

---

## 6) One-click start/stop (skripte)

### start_all.ps1 (u root chatt/)
Pokreće: Realtime, Orchestrator, STT, Frontend, Manual backend, Manual frontend.

### stop_all.ps1 (u root chatt/)
Gasi procese po portovima: 50505, 50506, 50507, 50605, 5173, 5174.

---

## 7) Backup / restore

Backup:
- kopiraj ceo folder chatt/

Restore:
1) Replace ceo chatt folder iz backupa
2) Otvori VS Code → Open Folder → chatt
3) Pokreni ručno (sekcija 5) ili start_all.ps1

Ako restore radiš na drugoj mašini i venv ne radi:
- napravi novi backend/.venv i instaliraj requirements.txt

---

## 8) Minimalni health check

- http://localhost:5173 (main UI)
- http://localhost:5174 (manual UI)

Orchestrator terminal treba da vidi:
- [Agent1] canonical_question=...

---

KRAJ.
