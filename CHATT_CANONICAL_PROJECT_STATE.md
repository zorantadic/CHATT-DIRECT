# CHATT Canonical Project State

Last updated: 2026-05-15

This file is the canonical working state for the CHATT project.  
Use it as the first reference before making architecture, configuration, Codex, backend, Desktop, or deployment changes.

---

## 1. Project Direction

CHATT is a personal-use real voice chat project.

The current priority is:

```text
Windows Electron Desktop app first
Shared backend local development second
Web frontend later / secondary
Docker and Azure Container Apps only after local validation
```

The immediate development target is the Windows Desktop/Electron application using the shared backend.

The web frontend is not the current priority.

Manual scenario exists but is out of scope for the current phase.

---

## 2. Main Runtime Scenario

Canonical main flow:

```text
Browser/web-session/system audio
→ STT
→ Orchestrator
→ Agent1
→ Orchestrator
→ Realtime voice model or TTS
→ headphones/output device selected by the app
```

Important invariant:

```text
Microphone must never be routed to STT in the main scenario.
```

STT receives only captured session/system/browser audio.

---

## 3. Current Primary Client

Primary client:

```text
C:\Projects\chatt\Desktop
```

Desktop package:

```text
C:\Projects\chatt\Desktop\package.json
```

Desktop start command:

```powershell
cd C:\Projects\chatt\Desktop
npm start
```

This runs:

```text
electron .
```

---

## 4. Active Backend Services

The backend is currently a Python/FastAPI backend under:

```text
C:\Projects\chatt\backend
```

Active services:

| Service | File | Port | Purpose |
|---|---|---:|---|
| Realtime/TTS backend | `backend/app_realtime.py` | 50505 | Voice answer via Realtime or TTS |
| Orchestrator | `backend/orchestrator/server.py` | 50506 | Transcript intake, Agent1 call, turn control |
| STT backend | `backend/speech_server.py` | 50507 | Speech-to-text WebSocket service |

Current local run model is manual VS Code terminals.  
No `ps1` startup scripts are part of the current active workflow.

---

## 5. Manual Local Backend Startup

Each backend service is started from:

```text
C:\Projects\chatt\backend
```

Every terminal must activate the backend virtual environment first:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 5.1 Realtime/TTS

```powershell
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

Expected local URL:

```text
http://127.0.0.1:50505
```

### 5.2 Orchestrator

```powershell
python -m uvicorn orchestrator.server:app --host 127.0.0.1 --port 50506 --log-level info
```

Expected local URL:

```text
http://127.0.0.1:50506
```

### 5.3 STT

```powershell
python -m uvicorn speech_server:app --host 127.0.0.1 --port 50507 --log-level info
```

Expected local URL:

```text
http://127.0.0.1:50507
```

STT WebSocket path:

```text
ws://127.0.0.1:50507/stt/ws/{sessionId}
```

---

## 6. Confirmed Local Backend Validation

The following were confirmed working locally:

```text
50505 Realtime/TTS backend: OK
50506 Orchestrator backend: OK
50507 STT backend: OK
Agent1 through local Orchestrator: OK
Desktop full local pipeline: OK
```

### 6.1 Realtime/TTS Health Test

Run from:

```text
C:\Projects\chatt
```

Command:

```powershell
Invoke-RestMethod http://127.0.0.1:50505/
```

Expected:

```text
status : ok
ws     : ws://127.0.0.1:50505/voice/ws
```

### 6.2 Orchestrator Docs Test

Run from:

```text
C:\Projects\chatt
```

Command:

```powershell
Invoke-WebRequest http://127.0.0.1:50506/docs -UseBasicParsing
```

Expected:

```text
StatusCode : 200
```

### 6.3 STT Docs Test

Run from:

```text
C:\Projects\chatt
```

Command:

```powershell
Invoke-WebRequest http://127.0.0.1:50507/docs -UseBasicParsing
```

Expected:

```text
StatusCode : 200
```

### 6.4 Agent1 Local Test Through Orchestrator

Run from:

```text
C:\Projects\chatt
```

Command:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:50506/v1/sessions/test-local-agent/transcripts" `
  -ContentType "application/json" `
  -Body '{"transcript":"Identify the business unit requiring immediate executive attention and generate an executive operational risk summary.","lang":"en-US"}'
```

Expected:

```text
status : ok
```

This confirms:

```text
local Orchestrator → Agent1 → OK
```

---

## 7. Desktop Local Endpoint Settings

To use the local backend from Desktop Settings, use:

```text
STT WS base
ws://127.0.0.1:50507/stt/ws

Orchestrator HTTP
http://127.0.0.1:50506

Control WS base
ws://127.0.0.1:50506/v1/control

Realtime HTTP
http://127.0.0.1:50505

Realtime WS
ws://127.0.0.1:50505/voice/ws
```

Why `ws://` locally:

```text
Local uvicorn services are not running TLS.
```

Why deployed URLs use `wss://`:

```text
Azure Container Apps endpoints are HTTPS/TLS-backed.
```

---

## 8. Previous Deployed Endpoint Values

These were the previously used deployed Container Apps endpoint values:

```text
STT WS base
wss://chatt-speech.ashyglacier-62457361.eastus2.azurecontainerapps.io/stt/ws

Orchestrator HTTP
https://chatt-orchestrator.ashyglacier-62457361.eastus2.azurecontainerapps.io

Control WS base
wss://chatt-orchestrator.ashyglacier-62457361.eastus2.azurecontainerapps.io/v1/control

Realtime HTTP
https://chatt-realtime.ashyglacier-62457361.eastus2.azurecontainerapps.io

Realtime WS
wss://chatt-realtime.ashyglacier-62457361.eastus2.azurecontainerapps.io/voice/ws
```

---

## 9. Current Azure Resource Values for Local Backend

The current working Azure values are represented in:

```text
C:\Projects\chatt\backend\.env
C:\Projects\chatt\backend\orchestrator\.env
```

Do not commit real secrets.

A non-secret template exists at:

```text
C:\Projects\chatt\backend\.env.example
```

### 9.1 Realtime Voice

```env
AZURE_OPENAI_ENDPOINT=https://agentfield.cognitiveservices.azure.com
AZURE_OPENAI_MODEL=gpt-realtime-mini
AZURE_OPENAI_API_VERSION=2025-05-01-preview
```

### 9.2 Agent1

```env
AGENT1_PROJECT_ENDPOINT=https://agentfield.services.ai.azure.com/api/projects/proj-default
AGENT1_AGENT_ID=asst_sS6A4EFTSyKUSbKpRh8v5rXu
```

Important:

```text
The Orchestrator code reads AGENT1_PROJECT_ENDPOINT and AGENT1_AGENT_ID.
```

It does not read these legacy aliases directly:

```text
AZURE_AI_PROJECT_ENDPOINT
AGENT1_ID
```

### 9.3 TTS

```env
AZURE_OPENAI_TTS_ENDPOINT=https://agentfield.cognitiveservices.azure.com
AZURE_OPENAI_TTS_DEPLOYMENT=gpt-4o-mini-tts
AZURE_OPENAI_TTS_API_VERSION=2025-03-01-preview
AZURE_OPENAI_TTS_VOICE=alloy
AZURE_OPENAI_TTS_RESPONSE_FORMAT=pcm
```

---

## 10. Important `.env` Findings

### 10.1 Duplicate `.env` Files

There are at least two relevant env files:

```text
C:\Projects\chatt\backend\.env
C:\Projects\chatt\backend\orchestrator\.env
```

The `backend\orchestrator\.env` can override or differ from `backend\.env`.

During troubleshooting, the local Agent1 failure was caused by stale values in:

```text
C:\Projects\chatt\backend\orchestrator\.env
```

Old failing endpoint:

```env
AGENT1_PROJECT_ENDPOINT=https://zoranspeechf.services.ai.azure.com/api/projects/proj-zoranspeechF
```

That hostname did not resolve locally.

Working Agent1 endpoint:

```env
AGENT1_PROJECT_ENDPOINT=https://agentfield.services.ai.azure.com/api/projects/proj-default
```

### 10.2 STT Inline Comment Issue

This form is unsafe:

```env
SPEECH_REGION=eastus2   # npr: eastus, westeurope...
```

Use this instead:

```env
SPEECH_REGION=eastus2
```

The local STT issue was resolved after correcting local STT env values.

---

## 11. STT Configuration

Working STT configuration should match the deployed Container App values.

Use:

```env
AZURE_SPEECH_REGION=eastus2
SPEECH_REGION=eastus2
SPEECH_LANG=en-US
SPEECH_SAMPLE_RATE=16000

STT_SEGMENTATION_STRATEGY=Default
STT_SEGMENTATION_SILENCE_TIMEOUT_MS=2000
STT_END_SILENCE_TIMEOUT_MS=2500
STT_INITIAL_SILENCE_TIMEOUT_MS=4000
STT_SEGMENTATION_MAXIMUM_TIME_MS=45000
STT_RECO_MODE=Conversation
STT_STABLE_PARTIAL_THRESHOLD=3
STT_CONTEXT_FLUSH_SILENCE_MS=2500
STT_DEFAULT_LANGUAGE=en-US
```

Known STT errors and meanings:

### 11.1 Authentication Error 401

Example:

```text
WebSocket upgrade failed: Authentication error (401)
```

Meaning:

```text
Azure Speech key or region is wrong.
```

### 11.2 Could Not Validate Speech Context

Example:

```text
Error code: 1007
Could not validate speech context
```

Meaning:

```text
Azure Speech accepted the connection, but rejected the speech context/configuration.
```

Confirmed fix in this project:

```text
Align local STT env values with working Container App settings.
Remove inline comments from runtime env values.
```

---

## 12. Answer Engines

The project supports two answer engines:

```text
Realtime voice
TTS
```

The Desktop UI already has engine selection.

The project also supports speech rate values such as:

```text
1.0
0.9
0.8
```

This should be preserved.

---

## 13. Existing Desktop Capabilities

Known existing capabilities:

```text
Realtime/TTS engine selection
Speech rate selection
STT enabled/language controls
Instruction prompt settings
Instruction profiles/presets
Output device selection
Headphones-only behavior
Audio buffer/pause behavior
Status/log indicators
Control WebSocket handling
SEND_TO_REALTIME handling
```

The Desktop app is ahead of the web app and should be treated as the primary client.

---

## 14. Planned Enhancements

The following enhancements are planned but not implemented yet.

### 14.1 Auto Send vs Review Before Send

Two modes:

```text
Auto Send
Review Before Send
```

Default:

```text
Auto Send
```

Reason:

```text
Auto Send must remain the lowest-latency mode.
```

Review mode adds control and may add delay.

### 14.2 Pending Question Queue

Review Before Send mode should show formulated questions before sending them to the voice model.

Required actions:

```text
Send selected question
Edit question
Delete question
Clear queue
```

Hold may be skipped initially for personal-use simplicity.

### 14.3 Stop Audio Now

Must immediately:

```text
stop local playback
clear local playback queue
clear local audio buffer
send backend cancel/stop if supported
```

This must not be just mute or pause.

### 14.4 Stop Before Sending to Voice Model

In Review Before Send mode, the question should wait before being sent to Realtime/TTS.

### 14.5 Voice Output Test

Add a one-click output test using the same playback path as Realtime/TTS output.

Purpose:

```text
verify audio plays only to selected headphones/output device
verify volume is acceptable
```

### 14.6 STT Presets

Add UI presets:

```text
Fast
Balanced
Careful
Custom
```

Custom should initially expose only the useful controls:

```text
context flush silence
segmentation silence
end silence
maximum segment time
```

Do not expose too many STT knobs at once.

### 14.7 Latency Panel

Measure and show:

```text
STT latency
Agent1 latency
Orchestrator latency
Realtime first-audio latency
Playback latency
Total turn latency
```

### 14.8 Instruction Prompt Workflow

Keep current prompt functionality but improve usability.

Preferred model:

```text
Default prompt
Preset selector
Short extra instruction
Editable template
Reset to default
```

Do not force writing a full new instruction prompt for every small change.

---

## 15. Latency Rule

All new features must follow this rule:

```text
Do not slow down Auto Send mode.
```

Design principle:

```text
Auto Send = fastest path
Review Queue = optional control path
```

---

## 16. Work Process Rules

For all future project work:

```text
Analyze first.
Then plan.
Then change code.
```

No skipping steps.

When giving tasks:

```text
maximum 1-2 tasks at a time
always specify exact folder/path
always specify exact command
```

Before moving to the next step:

```text
the previous step must be completed or explicitly skipped by the user
```

When modifying files:

```text
always provide the complete file content
no partial file snippets unless explicitly approved
if shortening is unavoidable, clearly state what was shortened
```

For Codex work:

```text
Codex must receive narrow scoped prompts
Inspect-only when appropriate
After Codex response, run git status --short
If Codex creates untracked files, inspect those files before commit
Do not commit until local test passes
```

---

## 17. Git Notes

Real `.env` files are not expected to be committed.

Current committed env template:

```text
backend/.env.example
```

The working `.env` files may remain local-only:

```text
backend/.env
backend/orchestrator/.env
```

Do not commit real keys or secrets.

---

## 18. Current Known Good State

As of this update, the known good local state is:

```text
Backend services manually started from backend/.venv
Realtime/TTS local service works
Orchestrator local service works
STT local service works
Agent1 through local Orchestrator returns status ok
Desktop can be configured to use local backend endpoints
STT issue fixed by aligning env values and removing inline runtime comments
```

This is the baseline for the next implementation phase.