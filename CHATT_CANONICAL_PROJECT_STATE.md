CHATT Canonical Project State
Last updated: 2026-05-18
This file is the current project-level canonical state for the `CHATT-DIRECT` repository.
Use this file before making project-wide decisions about architecture, repository cleanup, workflow, deployment, packaging, or future feature direction.
For detailed Direct Realtime runtime implementation details, use:
```text
CHATT_DIRECT_CANONICAL_STATE.md
```
---
1. Project Identity
`CHATT-DIRECT` is now a Windows/Electron Direct Realtime voice application.
The project is no longer the old multi-service CHATT architecture.
Current product direction:
```text
Windows Electron desktop app
Direct Azure OpenAI Realtime voice
single-engine runtime
BYOK provider/API configuration
packaged Windows app
```
Primary value:
```text
stable Direct Realtime voice workflow
low latency
headphones/output-device routing
clean local setup
user-owned provider credentials
workflow-specific voice assistant use cases
```
---
2. Canonical File Roles
This file:
```text
CHATT_CANONICAL_PROJECT_STATE.md
```
Purpose:
```text
project-level canonical state
repository direction
active vs removed architecture
current workflow
cleanup baseline
work rules
next-step guardrails
```
Detailed Direct runtime file:
```text
CHATT_DIRECT_CANONICAL_STATE.md
```
Purpose:
```text
Direct Realtime runtime details
Desktop/backend runtime flow
audio capture rule
port 50505 backend
Realtime configuration
worklet naming issue
runtime validation baseline
```
Both files are current.
---
3. Current Active Architecture
Canonical active runtime:
```text
Electron Desktop app
-> loopback/system/browser audio capture
-> backend/app_realtime.py /voice/ws on port 50505
-> Azure OpenAI Realtime session
-> Azure Realtime VAD/interruption
-> audio response
-> Desktop playback pipeline
-> selected headphones/output device
```
Only active backend service:
```text
backend/app_realtime.py
port 50505
```
Active local endpoints:
```text
Realtime HTTP
http://127.0.0.1:50505

Realtime WS
ws://127.0.0.1:50505/voice/ws
```
---
4. Active Repository Areas
Current active project root:
```text
C:\Projects\chatt-direct
```
Active Desktop app:
```text
C:\Projects\chatt-direct\Desktop
```
Active backend:
```text
C:\Projects\chatt-direct\backend
```
Important active files:
```text
Desktop/package.json
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/stt-worklet-processor.js
backend/app_realtime.py
backend/audio_utils.py
backend/instructions.json
backend/.env.example
backend/requirements.txt
docker-compose.yml
start_all.ps1
stop_all.ps1
CHATT_CANONICAL_PROJECT_STATE.md
CHATT_DIRECT_CANONICAL_STATE.md
```
Important note:
```text
Desktop/renderer/stt-worklet-processor.js has a legacy filename but is still used by Direct Realtime audio capture.
Do not delete or rename it without first confirming all AudioWorklet registrations and processor names.
```
Current Direct worklet usage:
```text
new URL("stt-worklet-processor.js", window.location.href)
processor name: direct-realtime-pcm16-24k
```
---
5. Removed / Deprecated Architecture
The following architecture is no longer active and must not be reintroduced without explicit design approval:
```text
STT backend
Orchestrator backend
Agent1 runtime path
Control WebSocket
TTS engine path
Manual answer backend
Frontend/Vite app
Azure Static Web Apps deployment flow
Full Pipeline Test flow
legacy renderer STT runtime path
legacy renderer Orchestrator runtime path
legacy renderer Control WS path
```
Inactive ports:
```text
50506
50507
50605
5173
5174
```
Removed runtime/deployment artifacts include:
```text
backend/speech_server.py
backend/Dockerfile.speech
backend/Dockerfile.manual
backend/Dockerfile.orchestrator
backend/speech_server.py.bak
backend/manual_answers.json
backend/instruction_profiles.json
Azure Static Web Apps YAML workflow files
```
---
6. Current Local Startup
Backend startup:
```powershell
cd C:\Projects\chatt-direct\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```
Desktop startup:
```powershell
cd C:\Projects\chatt-direct\Desktop
npm start
```
Optional helper script:
```powershell
cd C:\Projects\chatt-direct
.\start_all.ps1
```
Current helper scripts are reduced to Direct Realtime backend only:
```text
start_all.ps1 -> starts 50505 only
stop_all.ps1  -> stops 50505 only
```
---
7. Configuration Model
Backend runtime configuration comes from:
```text
C:\Projects\chatt-direct\backend\.env
```
Committed non-secret template:
```text
C:\Projects\chatt-direct\backend\.env.example
```
Current relevant Direct Realtime settings:
```env
AZURE_OPENAI_ENDPOINT=https://agentfield.cognitiveservices.azure.com
AZURE_OPENAI_KEY=<your-azure-openai-key>
AZURE_OPENAI_MODEL=gpt-realtime-1.5
AZURE_OPENAI_API_VERSION=2025-05-01-preview
AZURE_OPENAI_PROFILE=byom-azure-openai-realtime
REALTIME_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
INSTRUCTIONS_PATH=instructions.json
MAX_INSTRUCTIONS_LEN=8192
PORT=50505
DEBUG=false
```
Do not commit real secrets.
The Desktop settings currently use only:
```text
Realtime HTTP
Realtime WS
Realtime rate
Playback volume
Output device
Instruction controls
```
There are no active Desktop settings for:
```text
STT WS base
Orchestrator HTTP
Control WS base
TTS engine
Manual backend
Frontend/Vite
```
---
8. Critical Audio Rule
Direct Realtime input must use loopback/system/browser audio capture.
Do not introduce microphone capture.
Forbidden active input path:
```text
navigator.mediaDevices.getUserMedia
microphone input
new microphone permission flow
```
Canonical input path:
```text
electronAPI.enableLoopbackAudio()
navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
stop/remove video tracks immediately
use only returned system audio track
```
---
9. Current Desktop Behaviors To Preserve
Keep these working:
```text
Start Direct Realtime
Stop Direct Realtime
Reset session guard while Direct Realtime is active
Refresh Instructions
Realtime rate selector
Realtime playback volume slider
Selected output/headphones routing
Listening/Speaking indicators
Instruction preset selector/editor
Instruction refresh/update flow
Realtime playback pipeline through selected sink
Barge-in/interruption behavior
```
Reset behavior:
```text
If Direct Realtime is running, Reset session must not stop runtime.
It must log that Reset is skipped and tell the user to stop Direct Realtime first.
After Stop, Reset session may create a new session ID.
```
---
10. Completed Cleanup Baseline
Completed cleanup includes:
```text
Removed legacy backend/orchestrator module
Removed legacy frontend/Vite app
Removed legacy manual backend/frontend runtime
Removed legacy manual answers backend store
Removed legacy instruction profiles backend endpoint and file
Removed TTS backend path/config/branching
Removed TTS voice engine selector/runtime switching
Removed backend/app.py legacy TTS/agent backend
Removed legacy Desktop renderer profile subsystem
Removed legacy hidden Desktop controls
Decoupled Direct Realtime config from legacy cfg
Removed legacy endpoint settings writes
Removed dead legacy Desktop UI wiring
Removed legacy renderer runtime paths for STT, Orchestrator, Control WS, and Full Pipeline Test
Removed backend/speech_server.py
Removed backend/Dockerfile.speech
Removed backend/Dockerfile.manual
Removed backend/Dockerfile.orchestrator
Removed backend/speech_server.py.bak
Removed backend/manual_answers.json
Removed backend/instruction_profiles.json
Reduced docker-compose.yml to active Realtime backend only
Reduced start_all.ps1 and stop_all.ps1 to port 50505 only
Removed obsolete Azure Static Web Apps YAML workflow files
Removed obsolete frontend/manual-frontend gitignore exceptions
```
Recent cleanup commits include:
```text
Remove unused legacy backend artifacts
Guard legacy hidden control initialization
Decouple direct realtime config from legacy cfg
Remove legacy hidden desktop controls
Remove legacy endpoint settings writes
Remove dead legacy desktop UI wiring
Prevent reset from stopping active direct realtime
Remove legacy renderer runtime paths
Remove obsolete YAML workflow files
Remove legacy STT and orchestrator runtime artifacts
Remove obsolete frontend gitignore exceptions
```
---
11. Current Validation State
Confirmed after cleanup:
```text
python -m py_compile backend/app_realtime.py: OK
node --check Desktop/renderer/renderer.js: OK
Desktop package JSON parse: OK
Desktop app runtime test: OK
Direct Realtime voice test: OK
Start Direct Realtime: OK
Stop Direct Realtime: OK
Reset session while Direct Realtime is running: skipped without closing runtime
Reset session after Stop: creates a new session
Direct Realtime worked normally after final cleanup
```
---
12. Current Known Good State
Current known good local state:
```text
CHATT Direct is a Windows/Electron Direct Realtime voice app
Backend is Realtime-only on app_realtime.py port 50505
Desktop renderer no longer contains active STT/Orchestrator/Control/Full Pipeline runtime paths
backend/speech_server.py and backend/Dockerfile.speech are removed
Docker/start/stop runtime helpers are reduced to Direct Realtime 50505
Desktop runtime and voice flow were tested and worked after cleanup
```
---
13. Remaining Cleanup Work
Known remaining cleanup is documentation-only unless a new scan proves otherwise:
```text
README_SETUP.txt may need Direct-only rewrite
SETUP.md may need Direct-only rewrite
```
Runtime cleanup is complete for the currently verified Direct Realtime baseline.
Before further cleanup, run:
```powershell
cd C:\Projects\chatt-direct

git status --short
git diff --name-status
git grep -n "speech_server\|50507\|50506\|/stt/ws\|orchestrator\|manual_answers\|instruction_profiles\|TTS\|tts\|frontend\|manual-backend\|manual-frontend" -- .
```
Interpret broad grep results carefully. Some terms may appear in dependency hashes or documentation; do not treat a broad grep result as proof of active runtime usage.
---
14. Commercial Direction
Preferred commercial packaging model:
```text
Windows app sold as a packaged desktop application
Customer brings their own provider/API key
```
Product value should focus on:
```text
stable Direct Realtime voice workflow
low latency
headphones-only safe routing
clean setup
BYOK privacy/control
workflow-specific use cases
```
---
15. Work Process Rules
For all future project work:
```text
Analyze first
Plan second
Change code third
No broad cleanup without reference checks
No commit before diff review and runtime validation
Always specify exact folder/path for commands
Use one or two tasks at a time
```
For Codex work:
```text
Create backup branch before large refactors
Run git status --short after Codex
Inspect git diff --name-status and git diff --stat
Do not commit unreviewed runtime-generated changes
Restore accidental runtime changes before commit
```