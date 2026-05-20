# CHATT Direct Canonical State

Last updated: 2026-05-19

This file is the current Direct Realtime runtime canonical state for the `CHATT-DIRECT` repository.

Use this file before making changes to Desktop runtime behavior, backend Realtime behavior, audio capture/playback, instruction flow, runtime configuration, packaging, or cleanup that can affect the Direct Realtime application.

For project-level repository state and workflow rules, also use:

```text
CHATT_CANONICAL_PROJECT_STATE.md
```

---

## 1. Runtime Identity

`CHATT-DIRECT` is a Windows/Electron Direct Realtime voice application.

Canonical runtime direction:

```text
Electron Desktop app
Direct Realtime voice
single active backend service
multi-provider Realtime adapter runtime
Azure OpenAI Realtime and OpenAI Realtime support
Azure OpenAI Realtime uses gpt-realtime-2 through the OpenAI-compatible /openai/v1/realtime endpoint
loopback/system/browser audio input
selected provider voice in Realtime session.update
outgoing language steering through final Realtime instructions
incoming language planned as transcription language hint
selected headphones/output device playback
BYOK provider/API configuration
```

This runtime is no longer the old orchestrated CHATT flow.

Do not reintroduce:

```text
STT backend
Orchestrator backend
Agent1 runtime path
Control WebSocket
TTS engine path
Manual answer backend
Frontend/Vite runtime
Full Pipeline Test flow
```

---

## 2. Current Canonical Runtime Flow

Active Direct Realtime flow:

```text
Electron Desktop app
-> loopback/system/browser audio capture
-> backend/app_realtime.py /voice/ws on port 50505
-> active Realtime provider adapter
-> Azure OpenAI Realtime or OpenAI Realtime session
-> Azure provider uses OpenAI-compatible /openai/v1/realtime for gpt-realtime-2
-> provider-specific session.update payload
-> selected provider voice applied in session.update
-> outgoing language rule appended to effective instructions
-> provider VAD/interruption behavior
-> audio response
-> Desktop playback pipeline
-> selected headphones/output device
```

Only one backend service is canonical for active runtime:

```text
backend/app_realtime.py on port 50505
```

The active runtime does not use:

```text
50506
50507
50605
5173
5174
```

---

## 3. Critical Audio Rule

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

## 4. Local Paths

Project root:

```text
C:\Projects\chatt-direct
```

Desktop app:

```text
C:\Projects\chatt-direct\Desktop
```

Backend:

```text
C:\Projects\chatt-direct\backend
```

GitHub repo:

```text
https://github.com/zorantadic/CHATT-DIRECT
```

Canonical branch:

```text
main
```

Safety branch created before the large cleanup:

```text
backup-before-single-engine-realtime-cleanup
```

---

## 5. Active Backend Service

Run backend from:

```powershell
cd C:\Projects\chatt-direct\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

Expected local HTTP endpoint:

```text
http://127.0.0.1:50505
```

Expected Realtime WebSocket:

```text
ws://127.0.0.1:50505/voice/ws
```

The backend is single-engine Realtime only.

---

## 6. Desktop Startup

Run Desktop from:

```powershell
cd C:\Projects\chatt-direct\Desktop
npm start
```

The Desktop app owns:

```text
session state
loopback/system audio capture
Realtime start/stop controls
instruction UI
Realtime rate selection
playback pipeline
playback volume
output device routing
listening/speaking indicators
reset-session guard behavior
```

---

## 7. Active Runtime Configuration

Backend runtime configuration comes from:

```text
C:\Projects\chatt-direct\backend\.env
```

Committed non-secret template:

```text
C:\Projects\chatt-direct\backend\.env.example
```

Current relevant Direct Realtime template values:

```env
AZURE_OPENAI_ENDPOINT=https://agentfield.cognitiveservices.azure.com
AZURE_OPENAI_KEY=<your-azure-openai-key>
AZURE_OPENAI_MODEL=gpt-realtime-2
AZURE_OPENAI_API_VERSION=2025-05-01-preview
AZURE_OPENAI_PROFILE=byom-azure-openai-realtime
# AZURE_OPENAI_API_VERSION and AZURE_OPENAI_PROFILE remain present for compatibility/config history;
# the current Azure gpt-realtime-2 adapter uses /openai/v1/realtime?model=<deployment>.
OPENAI_API_KEY=<your-openai-key>
OPENAI_REALTIME_MODEL=gpt-realtime
REALTIME_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
INSTRUCTIONS_PATH=instructions.json
MAX_INSTRUCTIONS_LEN=8192
PORT=50505
DEBUG=false
```

Do not commit real secrets.

Desktop active endpoint settings:

```text
Realtime HTTP
http://127.0.0.1:50505

Realtime WS
ws://127.0.0.1:50505/voice/ws
```

Desktop no longer has active settings for:

```text
STT WS base
Orchestrator HTTP
Control WS base
TTS engine selector
Manual backend
Frontend/Vite
```

---

## 8. Current Direct Runtime Files

Important active Desktop files:

```text
Desktop/package.json
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/stt-worklet-processor.js
```

Important active backend files:

```text
backend/app_realtime.py
backend/audio_utils.py
backend/instructions.json
backend/provider_capabilities.json
backend/provider_config.py
backend/provider_config.local.example.json
backend/providers/base.py
backend/providers/__init__.py
backend/providers/azure_openai_realtime.py
backend/providers/openai_realtime.py
backend/.env.example
backend/requirements.txt
```

Runtime helper files:

```text
docker-compose.yml
start_all.ps1
stop_all.ps1
```

Current helper scope:

```text
docker-compose.yml -> active Realtime backend only
start_all.ps1    -> starts 50505 only
stop_all.ps1     -> stops 50505 only
```

---

## 9. Known Naming Issue

`Desktop/renderer/stt-worklet-processor.js` still exists and is tracked.

Do not delete it blindly.

Reason:

```text
The filename is legacy, but the file is still used by Direct Realtime audio capture.
```

Current Direct Realtime worklet registration uses:

```text
new URL("stt-worklet-processor.js", window.location.href)
processor name: direct-realtime-pcm16-24k
```

Possible future cleanup:

```text
Rename/split stt-worklet-processor.js to a Direct Realtime worklet name
only after confirming all AudioWorklet registrations and processor names.
```

---

## 10. Desktop Features To Preserve

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

## 11. Removed Runtime Paths

The following runtime paths have been removed from the active Direct implementation:

```text
legacy STT WebSocket runtime path
legacy Orchestrator HTTP transcript path
legacy Control WebSocket path
legacy SEND_TO_REALTIME path
legacy Full Pipeline Test path
legacy TTS engine selection/runtime switching
legacy instruction profile backend dependency
legacy hidden Desktop controls
legacy endpoint settings writes for STT/Orchestrator/Control
```

Removed backend/deployment artifacts include:

```text
backend/speech_server.py
backend/Dockerfile.speech
backend/Dockerfile.manual
backend/Dockerfile.orchestrator
backend/speech_server.py.bak
backend/manual_answers.json
backend/instruction_profiles.json
obsolete Azure Static Web Apps YAML workflow files
```

---

## 12. Cleanup Milestones

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
Reduced docker-compose.yml to active Realtime backend only
Reduced start_all.ps1 and stop_all.ps1 to port 50505 only
Removed obsolete Azure Static Web Apps YAML workflow files
Removed obsolete frontend/manual-frontend gitignore exceptions
```

---

## 13. Validation Baseline

Confirmed after cleanup:

```text
python -m py_compile backend/app_realtime.py: OK
node --check Desktop/renderer/renderer.js: OK
Desktop package JSON parse: OK
Desktop app runtime test: OK
Direct Realtime voice test: OK
Azure OpenAI Realtime runtime test: OK
OpenAI Realtime runtime test: OK
Provider-specific session.update payload handling: OK
OpenAI Realtime session schema compatibility: OK
Expanded provider capability lists for regions, voices, and languages: OK
Capability-driven Provider Configuration dropdowns: OK
Provider save/load persistence for selected voice/language/region: OK
Selected provider voice applied in Realtime session.update: OK
OpenAI selected voice runtime test: OK
Azure selected voice runtime test: OK
Azure gpt-realtime-2 runtime test through /openai/v1/realtime: OK
Azure OpenAI-compatible session.update schema: OK
Outgoing language rule appended to final Realtime instructions: OK
Outgoing language runtime behavior test: OK
Start Direct Realtime: OK
Stop Direct Realtime: OK
Reset session while Direct Realtime is running: skipped without closing runtime
Reset session after Stop: creates a new session
Direct Realtime worked normally after final cleanup
```

Before committing runtime changes, always run at minimum:

```powershell
cd C:\Projects\chatt-direct
node --check .\Desktop\renderer\renderer.js
git status --short
git diff --name-status
git diff --stat
```

For backend changes, also run:

```powershell
cd C:\Projects\chatt-direct
python -m py_compile backend/app_realtime.py backend/provider_config.py backend/providers/base.py backend/providers/azure_openai_realtime.py backend/providers/openai_realtime.py
```

---

## 14. Current Stable Baseline

Current stable runtime baseline:

```text
CHATT Direct is a Windows/Electron Direct Realtime voice app
Backend is Realtime-only on app_realtime.py port 50505
Backend supports active Realtime provider selection through provider adapters
Azure OpenAI Realtime and OpenAI Realtime are both validated providers
Azure OpenAI Realtime is validated on gpt-realtime-2 through /openai/v1/realtime
Desktop renderer no longer contains active STT/Orchestrator/Control/Full Pipeline runtime paths
backend/speech_server.py and backend/Dockerfile.speech are removed
Docker/start/stop runtime helpers are reduced to Direct Realtime 50505
Desktop runtime and voice flow were tested and worked after cleanup
OpenAI Realtime runtime worked and produced better natural voice quality during local testing
Real websocket provider network tests passed for OpenAI and Azure
Provider capability lists are expanded and rendered correctly in Desktop settings
Provider save/load persistence is confirmed
Selected provider voice is passed into Realtime session.update and works for OpenAI/Azure
Azure provider uses OpenAI-compatible voices such as alloy with gpt-realtime-2
Outgoing language is added to final Realtime instructions and works as language steering
```

Recent provider integration commits:

```text
Add provider-specific realtime session payload handling
Add adapter-level provider config test
Add realtime provider network connection test
Expand provider capability lists
Use selected provider voice in realtime session
Add outgoing language rule to realtime instructions
Migrate Azure realtime provider to gpt-realtime-2
```

Before continuing in a new session, run:

```powershell
cd C:\Projects\chatt-direct

git status --short
git diff --name-status
git grep -n "speech_server\|50507\|50506\|/stt/ws\|orchestrator\|manual_answers\|instruction_profiles\|TTS\|tts\|frontend\|manual-backend\|manual-frontend" -- .
```

Interpret broad grep results carefully. Some terms may appear in dependency hashes or documentation; do not treat a broad grep result as proof of active runtime usage.


---


## 15. Provider Configuration and Runtime Adapter Baseline

Provider configuration is now part of the Direct runtime setup surface and drives the active Realtime runtime session.

Current supported setup/runtime providers:

```text
Azure OpenAI Realtime
OpenAI Realtime
```

Runtime rule:

```text
Only one Realtime voice provider can be active at a time.
Provider/model/language changes must not be applied while Direct Realtime is running.
```

Current Desktop Settings tab includes Provider Configuration with:

```text
Active provider
Region dropdown for Azure OpenAI Realtime
Endpoint
API version
Deployment / model name
Voice
Incoming language
Outgoing language
API key
Test connection
Save provider
Reset provider settings placeholder
```

Current provider backend files:

```text
backend/provider_capabilities.json
backend/provider_config.local.example.json
backend/provider_config.py
backend/provider_config.local.json   # generated locally and ignored by Git
backend/providers/base.py
backend/providers/__init__.py
backend/providers/azure_openai_realtime.py
backend/providers/openai_realtime.py
```

Current provider backend API endpoints:

```text
GET  /v1/provider/capabilities
GET  /v1/provider/config
POST /v1/provider/config
GET  /v1/provider/active
POST /v1/provider/test
```

Current Test connection behavior:

```text
POST /v1/provider/test performs required-field validation first.
If required fields are present, it performs a real async Realtime websocket network probe.
The probe opens the configured provider websocket and closes immediately.
The probe does not send audio.
The probe does not send session.update.
The probe does not start Direct Realtime.
```

Confirmed provider network test results:

```text
OpenAI Realtime websocket connection succeeded.
Azure OpenAI Realtime websocket connection succeeded.
```

Current runtime provider behavior:

```text
/voice/ws reads activeProvider from saved provider config.
The selected adapter builds provider URL and authentication headers.
The selected adapter builds provider-specific session.update payload.
Selected provider voice is included in session.update.
Outgoing language is appended to effective Realtime instructions before session.update.
Desktop audio routing remains unchanged.
Loopback/system/browser audio remains the only allowed input source.
PCM16 24k mono audio path remains unchanged.
```

Provider-specific session.update rules:

```text
Azure OpenAI Realtime now uses the OpenAI-compatible /openai/v1/realtime endpoint for gpt-realtime-2.
Azure OpenAI Realtime uses session.type = "realtime".
Azure OpenAI Realtime VAD configuration is under session.audio.input.turn_detection.
OpenAI Realtime uses session.type = "realtime".
OpenAI Realtime VAD configuration is under session.audio.input.turn_detection.
OpenAI Realtime does not accept Azure-style session.turn_detection.
OpenAI provider uses selected saved voice in session.audio.output.voice.
Azure provider uses selected saved voice as the OpenAI-compatible audio output voice string.
Outgoing language is not sent as a separate Realtime API field; it is applied through final session instructions.
Incoming language is planned as provider-specific transcription language hint.
```

Current local config storage:

```text
backend/provider_config.local.json
```

Packaging requirement:

```text
Before packaged Windows app release, provider settings must be stored in a user-specific app data location, not inside the installed app folder or repository backend folder.
Target pattern: Electron app.getPath("userData") / Windows AppData.
```

Language control:

```text
Incoming language and Outgoing language are explicit Setup settings.
Default: English incoming, English outgoing.
Dropdown values must be loaded from the selected provider capability profile.
Do not guess supported provider languages.
```

Canonical language design:

```text
Modern Realtime voice models are multilingual.
The project problem is stabilizing language behavior, not adding translation mode.

incomingLanguage
= transcription language hint
= tells the model which language to expect in incoming audio
= speech recognition guidance

outgoingLanguage
= response language guidance
= appended to final Realtime session instructions
= tells the model which language to answer in
```

Implemented outgoing language behavior:

```text
The editable Instruction tab text is not modified.
Before session.update, backend creates effective instructions:
current instruction + LANGUAGE RULE for selected outgoingLanguage.
Changing Outgoing language requires Save provider.
Refresh Instructions resends the effective instruction with the saved outgoingLanguage rule.
```

Planned incoming language behavior:

```text
Add incomingLanguage to session.update as provider-specific transcription language hint.
Do not route this through translation mode.
Do not use microphone input.
Do not change the loopback/system/browser audio flow.
```

Current capability values:

```text
Azure default model: gpt-realtime-2
Azure regions: Canada Central, Central US, East US 2, France Central, Sweden Central, South India
Voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
Incoming language: full supported dropdown list from provider_capabilities.json
Outgoing language: full supported dropdown list from provider_capabilities.json
```

Current known provider UX limitation:

```text
Desktop Test connection UI may show a generic pass/fail label.
The backend API returns the detailed provider/network message.
```

---

## 16. Remaining Work

Known remaining cleanup is documentation-only unless a new scan proves otherwise:

```text
README_SETUP.txt may need Direct-only rewrite
SETUP.md may need Direct-only rewrite
```

Runtime cleanup is complete for the currently verified Direct Realtime baseline.

---

## 17. Commercial Direction

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

## 18. Work Rules

For all future work:

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