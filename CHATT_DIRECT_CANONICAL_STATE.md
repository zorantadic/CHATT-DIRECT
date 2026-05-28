# CHATT Direct Canonical State

Last updated: 2026-05-28

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
scenario preset based behavior selection
Scenarios tab with one-click assistant behavior selection
compact clickable scenario cards with selected-state styling
hover details popup for scenario human-readable explanation
Voice page selected scenario visibility
multilingual UI display support
header language selector synchronized with Settings language selector
floating vertical Mini Control Window when the main app is minimized
deterministic Electron UI zoom factor 0.7 for main Desktop window
hosted Azure Licensing API for 3-day free trial registration and validation
free trial anti-reset protection through installId, emailHash, and deviceHash
trial/start rate limiting
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
scenario selection/display
compact clickable scenario cards
scenario hover details popup
Realtime rate selection
playback pipeline
playback volume
output device routing
listening/speaking indicators
reset-session guard behavior
floating Mini Control Window lifecycle and command forwarding
main window baseline and deterministic UI zoom application
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
SCENARIO_PRESETS_PATH=scenario_presets.local.json
SCENARIO_PRESETS_DEFAULT_PATH=scenario_presets.json
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
Desktop/electron/main.cjs
Desktop/electron/preload.cjs
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/styles.css
Desktop/renderer/mini-control.html
Desktop/renderer/mini-control.css
Desktop/renderer/mini-control.js
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
backend/scenario_presets.json
backend/scenario_presets.local.json   # generated locally and ignored by Git
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
Scenario preset selector/editor
Compact clickable scenario cards with selected-state styling
Scenario hover details popup
Scenarios tab and selected scenario display on Voice page
Instruction refresh/update flow
Realtime playback pipeline through selected sink
Barge-in/interruption behavior
Modern Voice / Settings / Scenarios dark glass UI layout
Responsive Desktop window behavior at 1120 x 820 default and 860 x 720 minimum
Scenario Preview slot with displayDetails metadata and no model-facing instruction prompt
Mini Control Window when the main app is minimized
Mini Control Window commands: Start, Stop, Refresh, Repeat, Reset, Open
Mini Control Window status sync: Session and Activity
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
Scenario presets backend API: OK
Scenario active selection persistence: OK
Scenario per-scenario instruction override API: OK
Scenario first-run local seed from default template: OK
Desktop Scenarios tab loads backend scenario presets: OK
Desktop UI renders compact clickable backend scenario cards: OK
Desktop scenario hover details popup: OK
Desktop Save persists custom instruction overrides per scenario: OK
Desktop Reset to scenario default removes custom instruction override and restores original scenario prompt: OK
Voice page displays selected scenario: OK
Legacy dropdown presets hidden when backend scenarios are available: OK
Modern Desktop UI modernization Phase 1 Voice page: OK
Modern Desktop UI modernization Phase 2 Settings page: OK
Modern Desktop UI modernization Phase 3 Scenarios page: OK
Desktop default window size 1120 x 820 and minimum 860 x 720: OK
Desktop deterministic UI zoom factor 0.7 applied immediately and after did-finish-load: OK
Development profile persisted zoom masking issue identified and neutralized by deterministic app zoom: OK
Scenario Preview slot uses displayDetails fallback to shortDescription and does not show scenario.instruction: OK
Mini Control Window opens when the main app is minimized: OK
Mini Control Window vertical layout fits visible window: OK
Mini Control Window can be moved across the desktop: OK
Mini Control Window Open restores the main app: OK
Mini Control Window Start/Stop/Refresh/Repeat/Reset commands work through existing main renderer controls: OK
Mini Control Window Session and Activity status sync: OK
Desktop version bumped to 0.1.8: OK
Desktop package.json and package-lock.json UTF-8 without BOM after version bump: OK
Electron build for 0.1.8: OK
Installer AnswerDesk AI Setup 0.1.8.exe created: OK
Installer 0.1.8 installed and upgraded over prior installation successfully: OK
Old backup folders and old installer artifacts cleaned: OK
Git clean after 0.1.8 release validation: OK
```

Before committing runtime changes, always run at minimum:

```powershell
cd C:\Projects\chatt-direct
node --check .\Desktop\electron\main.cjs
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
Scenario preset foundation is implemented through backend/scenario_presets.json, GET /v1/scenarios, POST /v1/scenarios/active, POST /v1/scenarios/instruction, and DELETE /v1/scenarios/instruction/{scenario_id}
Desktop Scenarios tab loads backend scenario presets, renders compact clickable scenario cards, shows human-readable hover details, supports per-scenario custom instruction overrides, and falls back to legacy local presets only when backend scenarios are unavailable
Voice page displays the selected scenario name and behavior description
Desktop UI is modernized across Voice, Settings, and Scenarios with dark glass/3D design language
Desktop main window uses canonical 1120 x 820 default with 860 x 720 minimum
Desktop main window applies deterministic APP_UI_ZOOM_FACTOR = 0.7 in Electron main process
UI scale is not allowed to depend on Chromium persisted per-host zoom state
Voice page uses Session and Activity as primary user-facing status indicators
Settings page is organized as a dark glass control center with Connection, Audio Output, Provider Configuration, Session Cost Guard, Diagnostics, Auth, and Log cards
Scenarios page is organized as Scenario & Instructions with Selected Scenario, Scenario Library, Scenario Preview, Current Instructions, and Scenario Default Instructions cards
Scenario Preview displays human-readable metadata using displayDetails when available and never displays scenario.instruction
Bottom app status bar no longer shows the redundant bottom volume mirror
Header Backend/Provider cards removed and replaced with compact Select Language control
Settings Display Language and Header Select Language controls remain synchronized through shared display-language state
Minimizing the main app opens a floating vertical Mini Control Window
Mini Control Window is an Electron UI remote-control layer only
Mini Control Window does not own or duplicate Direct Realtime audio, WebSocket, backend, provider, or scenario runtime
Mini Control Window controls existing main renderer commands for Start, Stop, Refresh Instructions, Repeat Last Answer, and Reset Session
Mini Control Window displays synchronized Session and Activity state from the main renderer
Mini Control Window Open restores the main app and closes the mini control
Desktop release 0.1.8 build and installer upgrade are validated


Multilingual UI v1 baseline:

```text
Desktop supports UI-only multilingual display localization.
Supported display languages:
- English (EN)
- Spanish (ES)
- German (DE)
- Serbian (SR)

Localization scope:
- visible static UI labels
- tabs
- page titles
- section titles
- helper text
- scenario metadata
- scenario category
- scenario shortDescription
- scenario recommendedUse
- scenario displayDetails
```

Instruction localization rule:

```text
Display language changes must not change model-facing instructions.
Scenario instruction prompts remain English canonical.
Current Instructions and Scenario Default Instructions remain English canonical unless user-authored overrides exist.
Refresh Instructions and Start Direct Realtime continue sending English canonical/runtime instruction text.
```

Recent multilingual UI commits:

```text
3c1e67a Add multilingual UI display support
0260f6e Add header language selector
```

Recent mini control / 0.1.8 release commits:

```text
cf9a760 Add mini control window for minimized app
28416ed Bump desktop version to 0.1.8
a0ac25c Fix desktop package JSON encoding
Set desktop window baseline and UI zoom
```
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
Track direct realtime session activity timestamps
Update direct realtime idle timestamp on speech start
Add session cost guard settings
Add session cost guard warning timer
Stop direct realtime on session cost guard limits
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

---

## 16. Scenario Presets Runtime Baseline

Scenario presets are now supported as a Direct Realtime behavior selection layer.

Current backend scenario files:

```text
backend/scenario_presets.json
backend/scenario_presets.local.json   # generated locally and ignored by Git
```

Current scenario path variables:

```env
SCENARIO_PRESETS_PATH=scenario_presets.local.json
SCENARIO_PRESETS_DEFAULT_PATH=scenario_presets.json
```

Current scenario API:

```text
GET    /v1/scenarios
POST   /v1/scenarios/active
POST   /v1/scenarios/instruction
DELETE /v1/scenarios/instruction/{scenario_id}
```

Current first-run behavior:

```text
If SCENARIO_PRESETS_PATH does not exist, backend seeds/copies from SCENARIO_PRESETS_DEFAULT_PATH.
After the local file exists, backend reads the local file for runtime scenario state.
The local file is not committed.
The install/default file is treated as read-only template content.
```

Current Desktop behavior:

```text
Scenarios tab loads GET /v1/scenarios.
Scenario cards display backend scenario presets when available.
Scenario cards are compact and show only the scenario name plus Selected / Click to select state.
Hovering over or focusing a scenario card updates the Scenario Preview slot inside the Scenario Library panel.
Scenario Preview shows scenario name, category, displayDetails when available, and recommendedUse.
If displayDetails is missing, Scenario Preview falls back to shortDescription.
Scenario Preview does not show the model-facing instruction prompt.
Scenario Preview is informational only and does not select or modify the scenario.
Scenario dropdown displays backend scenario presets when available.
Legacy hardcoded presets are hidden when backend scenarios exist and remain only as fallback when backend scenarios are unavailable.
Selecting a scenario card or dropdown item loads scenario.userInstruction into Current Instructions when present; otherwise it loads scenario.instruction.
Scenario Default Instructions always shows the original scenario.instruction.
Desktop calls POST /v1/scenarios/active to persist activeScenarioId in the local scenario runtime state.
Desktop Save calls POST /v1/scenarios/instruction to store edited Current Instructions as scenario.userInstruction for the selected scenario.
Desktop Reset to scenario default calls DELETE /v1/scenarios/instruction/{scenario_id}, removes scenario.userInstruction, and restores Current Instructions to scenario.instruction.
Voice page displays the selected scenario name and scenario behavior.
Refresh Instructions still sends the current backend instruction state to the active Realtime session.
```

Per-scenario instruction override model:

```text
scenario.instruction
= original/default scenario prompt
= read-only template behavior from the scenario definition
= shown as Scenario Default Instructions

scenario.userInstruction
= optional user-edited scenario prompt override
= stored in scenario_presets.local.json
= loaded as Current Instructions when present
= saved through POST /v1/scenarios/instruction
= removed through DELETE /v1/scenarios/instruction/{scenario_id}

scenario.userInstructionUpdatedAt
= timestamp for the userInstruction override
```

Runtime instruction selection rule:

```text
if scenario.userInstruction exists:
  Current Instructions = scenario.userInstruction
  Scenario Default Instructions = scenario.instruction
else:
  Current Instructions = scenario.instruction
  Scenario Default Instructions = scenario.instruction
```

Current implemented default scenarios include:

```text
Direct Answer
Candidate Coach
Interviewer Evaluator
Meeting Advisor
Translator + Coach
Technical Consultant
Sales Objection Handler
Support Troubleshooter
Compliance / Risk Monitor
Trainer Mode
Cloud Architecture Advisor
Interview Answer Mode
```

This scenario layer must not change:

```text
loopback/system/browser audio input
selected headphones/output-device playback
provider runtime selection
Realtime provider adapter behavior
Realtime WebSocket path
instruction refresh WebSocket message shape
```

Prompt migration rule:

```text
Cloud Architecture Advisor and Interview Answer Mode were migrated from legacy renderer prompts.
Their instruction text must be treated as preserved prompt-engineering work.
Do not rewrite those scenario instructions unless explicitly approved.
Custom user edits must be stored as userInstruction overrides, not by modifying the default instruction text.
```

Scenario UX rule:

```text
Scenario card content is intentionally compact.
Scenario Preview uses human-readable metadata, not the model-facing instruction prompt.
displayDetails is the preferred richer human-readable Scenario Preview text.
shortDescription remains the fallback when displayDetails is missing.
```

Final packaged app direction:

```text
<install>\backend\scenario_presets.json
<AppData>\CHATT-DIRECT\scenario_presets.local.json
<AppData>\CHATT-DIRECT\instructions.json
<AppData>\CHATT-DIRECT\provider_config.local.json
<AppData>\CHATT-DIRECT\logs\
```

---


---

## 17. Desktop Window Baseline and Deterministic UI Zoom

The Desktop main window size and visual scale are now part of the Direct runtime baseline.

Current BrowserWindow baseline in `Desktop/electron/main.cjs`:

```text
width: 1120
height: 820
minWidth: 860
minHeight: 720
```

Current deterministic UI zoom baseline:

```text
APP_UI_ZOOM_FACTOR = 0.7
Applied to mainWindow.webContents immediately after BrowserWindow creation.
Re-applied on webContents did-finish-load.
```

Root cause finding:

```text
The installed Windows app was not incorrectly zoomed.
The old development Electron profile under Desktop/.electron-userdata had a persisted Chromium per-host zoom entry around -2.0.
That persisted zoom made npm start appear visually smaller and masked the true app scale.
After renaming/resetting Desktop/.electron-userdata, development mode matched the installed app and appeared larger.
The accepted product fix is deterministic Electron app zoom, not persisted Chromium profile zoom and not broad CSS rewrite.
```

Implementation rule:

```text
Do not rely on Chromium Preferences per_host_zoom_levels.
Do not solve this with user instructions to Ctrl-minus / Ctrl-plus.
Do not use broad CSS density rewrite for this specific scale issue unless explicitly approved.
Keep APP_UI_ZOOM_FACTOR centralized in Desktop/electron/main.cjs.
If scale must be tuned later, adjust APP_UI_ZOOM_FACTOR first and validate dev + installed app before changing renderer CSS.
```

Validation baseline:

```text
node --check Desktop/electron/main.cjs: OK
node --check Desktop/renderer/renderer.js: OK
Only Desktop/electron/main.cjs changed for the accepted patch.
No CSS files changed.
No renderer.js, index.html, backend, provider, scenario, or audio/runtime files changed.
Runtime visual test with APP_UI_ZOOM_FACTOR = 0.7: OK
Git clean after commit: OK
```

Boundaries:

```text
This change is Desktop visual scale only.
It does not change loopback/system audio capture.
It does not change Realtime WebSocket behavior.
It does not change provider adapters or session.update payloads.
It does not change scenarios, instruction flow, Cost Guard, or Mini Control Window command ownership.
```

---


## 18. Mini Control Window and 0.1.8 Release Baseline

Mini Control Window is part of the Direct Desktop runtime UI baseline.

Completed commits:

```text
cf9a760 Add mini control window for minimized app
28416ed Bump desktop version to 0.1.8
a0ac25c Fix desktop package JSON encoding
```

Current mini control files:

```text
Desktop/renderer/mini-control.html
Desktop/renderer/mini-control.css
Desktop/renderer/mini-control.js
```

Electron integration:

```text
Desktop/electron/main.cjs owns the miniControlWindow BrowserWindow lifecycle.
Desktop/electron/preload.cjs exposes window.electronAPI.miniControl.
Desktop/renderer/renderer.js remains the only owner of Direct Realtime Start/Stop/Refresh/Repeat/Reset behavior.
```

Current mini control behavior:

```text
When the main app is minimized, Electron opens a small floating Mini Control Window.
The Mini Control Window is always-on-top, frameless, transparent/dark glass, skipped from taskbar, and movable by dragging the header area.
The Mini Control Window uses a narrow vertical layout.
The Mini Control Window shows Session and Activity status.
The Mini Control Window provides Start, Stop, Refresh, Repeat, Reset, and Open controls.
Open restores the main app and closes the Mini Control Window.
Closing the Mini Control Window does not stop the main app, backend, audio session, or provider session.
```

Command routing:

```text
Mini Control Window -> electronAPI.miniControl.sendCommand(command)
preload.cjs -> ipcRenderer.invoke("mini-control:command", command)
main.cjs -> mainWindow.webContents.send("mini-control:command", { command })
renderer.js -> existing main button click / existing runtime function path
```

Current command mapping:

```text
start   -> btnStart
stop    -> btnStop
refresh -> btnInstrRefresh
repeat  -> btnRepeatLastAnswer
reset   -> btnResetSession
```

Status synchronization:

```text
renderer.js publishes Session and Activity state through electronAPI.miniControl.publishStatus(...).
main.cjs forwards status payloads to mini-control.html.
mini-control.js updates Session, Activity, and disabled button states.
Session and Activity values remain owned by the main renderer.
```

Runtime ownership rule:

```text
Mini Control Window is a remote UI layer only.
It must not open a second Direct Realtime WebSocket.
It must not create a second AudioContext.
It must not call backend Realtime APIs directly.
It must not own provider/runtime/scenario/instruction state.
It must not bypass the existing main renderer buttons or runtime guards.
```

Release validation:

```text
node --check Desktop/electron/main.cjs: OK
node --check Desktop/electron/preload.cjs: OK
node --check Desktop/renderer/renderer.js: OK
node --check Desktop/renderer/mini-control.js: OK
Runtime test: OK
Mini Control Window opens on minimize: OK
Mini Control Window vertical layout fits visible window: OK
Mini Control Window can be moved across the desktop: OK
Open restores main app: OK
Start/Stop/Refresh/Repeat/Reset work from Mini Control Window: OK
Session and Activity status sync: OK
Desktop version 0.1.8: OK
package.json and package-lock.json UTF-8 without BOM: OK
Electron build 0.1.8: OK
Installer created: dist\AnswerDesk AI Setup 0.1.8.exe
Installer 0.1.8 upgrade over previous installed version: OK
Old backup folders and old installer artifacts cleaned: OK
Git clean after validation: OK
```

Boundaries:

```text
Do not change loopback/system audio capture because of Mini Control Window.
Do not change app_realtime.py because of Mini Control Window.
Do not change Realtime provider adapters because of Mini Control Window.
Do not change scenario APIs because of Mini Control Window.
Do not remove or bypass existing main renderer Start/Stop/Refresh/Repeat/Reset handlers.
```

---

## 19. Phase 2 AppData / userData Runtime Plan

Phase 2 objective:

```text
Move packaged runtime/user state out of the install/backend folder and into Electron userData/AppData.
```

Canonical packaged app storage rule:

```text
Install folder = read-only application files and default templates.
AppData/userData = writable runtime/user files.
```

Final user data folder:

```text
<AppData>\CHATT-DIRECT\
```

Final writable runtime files:

```text
<AppData>\CHATT-DIRECT\provider_config.local.json
<AppData>\CHATT-DIRECT\instructions.json
<AppData>\CHATT-DIRECT\scenario_presets.local.json
<AppData>\CHATT-DIRECT\license_state.json
<AppData>\CHATT-DIRECT\device_seed        # fallback only if Windows MachineGuid cannot be read
<AppData>\CHATT-DIRECT\logs\
```

Final read-only install/template files:

```text
<install>\backend\provider_capabilities.json
<install>\backend\provider_config.local.example.json
<install>\backend\scenario_presets.json
<install>\backend\app_realtime.py
<install>\backend\providers\
```

Backend must receive explicit paths from Electron in packaged runtime:

```env
PROVIDER_CONFIG_PATH=<AppData>\CHATT-DIRECT\provider_config.local.json
INSTRUCTIONS_PATH=<AppData>\CHATT-DIRECT\instructions.json
SCENARIO_PRESETS_PATH=<AppData>\CHATT-DIRECT\scenario_presets.local.json
PROVIDER_CAPABILITIES_PATH=<install>\backend\provider_capabilities.json
PROVIDER_CONFIG_EXAMPLE_PATH=<install>\backend\provider_config.local.example.json
SCENARIO_PRESETS_DEFAULT_PATH=<install>\backend\scenario_presets.json
PORT=50505
```

Electron main process responsibilities for Phase 2:

```text
Use app.getPath("userData") as the root user data location.
Create the CHATT-DIRECT user runtime folder if needed.
Seed or migrate runtime files before backend startup.
Start the backend as a child process with explicit env path variables.
Keep backend stdout/stderr available for diagnostics/logging.
Stop backend when Desktop exits.
```

First-run seed/migration rules:

```text
provider_config.local.json:
  Create from provider_config.local.example.json if missing, or let backend fallback create equivalent initial state.

instructions.json:
  Use the existing instruction default/preset behavior.
  If an older Electron instructions.local.json exists and instructions.json does not, migrate or normalize it.

scenario_presets.local.json:
  If missing, seed from install/backend/scenario_presets.json.
  Never overwrite an existing user scenario file on app update.
```

Phase 2 must preserve existing runtime behavior:

```text
Desktop still connects to http://127.0.0.1:50505 and ws://127.0.0.1:50505/voice/ws.
Loopback/system/browser audio remains the only input source.
Microphone input remains forbidden.
Provider runtime selection remains backend/provider adapter owned.
Outgoing language remains instruction-level steering.
Incoming language remains planned as transcription language hint.
Scenario selection remains instruction behavior selection.
```

Phase 2 must not change:

```text
provider adapter Realtime schemas
audio capture/playback pipeline
instruction refresh WebSocket message shape
scenario API shape unless explicitly approved
manual/STT/TTS/Orchestrator/Agent1 legacy paths
```

Phase 2 validation commands:

```powershell
cd C:\Projects\chatt-direct
node --check .\Desktop\electron\main.cjs
node --check .\Desktop\electron\preload.cjs
node --check .\Desktop\renderer\renderer.js
python -m py_compile backend/app_realtime.py backend/provider_config.py
git status --short
git diff --name-status
git diff --stat
```

Phase 2 runtime validation:

```text
Desktop starts backend or gives a clear backend startup error.
Provider config API works through localhost.
Instructions API works through localhost.
Scenarios API works through localhost.
POST /v1/scenarios/instruction persists userInstruction to AppData scenario runtime state.
DELETE /v1/scenarios/instruction/{scenario_id} removes userInstruction from AppData scenario runtime state.
Provider save writes to AppData.
Instruction save writes to AppData.
Scenario local runtime file is created in AppData if missing.
Start Direct Realtime still works.
Stop Direct Realtime still works.
Reset session guard still works.
```


## 20. Session Cost Guard Runtime Baseline

Session Cost Guard is part of the Desktop renderer runtime layer.

Current UI location:

```text
Settings -> Connection + Audio Settings
```

Current controls:

```text
Auto-stop if idle: Off / 5 / 10 / 15 minutes
Warn before auto-stop: checked/unchecked
Hard max session duration: Off / 15 / 30 / 60 minutes
```

Persistence keys:

```text
chatt.costGuard.idleMinutes
chatt.costGuard.warnBeforeStop
chatt.costGuard.maxSessionMinutes
```

Runtime state:

```text
directSessionStartedAt
directLastSpeechStartedAt
costGuardTimer
costGuardLastIdleWarnAt
costGuardLastMaxWarnAt
```

Runtime behavior:

```text
directSessionStartedAt is set when Direct Realtime start begins.
directLastSpeechStartedAt is initialized from directSessionStartedAt and then updated whenever the renderer receives input_audio_buffer.speech_started.
Cost Guard timer starts after Direct Realtime successfully starts.
Cost Guard timer stops inside the existing stopDirectRealtime flow.
checkCostGuard runs periodically and evaluates idle and hard max limits.
Warning logs are emitted only when Warn before auto-stop is enabled.
Idle limit reached calls stopDirectRealtime({ closeRealtime: true }).
Hard max session duration reached calls stopDirectRealtime({ closeRealtime: true }).
```

Confirmed runtime test:

```text
Idle warning appeared approximately 30 seconds before a 5-minute idle limit.
Idle limit reached logged the stop reason.
Audio stopped immediately.
Direct Realtime stopped.
Realtime WebSocket closed cleanly with reason direct-realtime-stop.
```

Design boundaries:

```text
Idle is based only on input_audio_buffer.speech_started.
Do not use audio chunk/frame activity as idle signal.
Do not add microphone input.
Do not change AudioWorklet, PCM format, sample rate, WebSocket audio append, provider adapter payloads, or backend app_realtime.py for Cost Guard.
Cost Guard belongs to Connection + Audio Settings, not Provider Configuration.
```

Next candidate improvements:

```text
Cost Guard UX improvement:
- countdown/status in UI
- remaining time display
- toast/modal warning instead of log-only warning

Stability and cost improvement:
- protection when app is minimized/inactive
- pause/resume behavior
- reconnect policy review
```

## 21. Remaining Work

Known remaining cleanup is documentation-only unless a new scan proves otherwise:

```text
README_SETUP.txt may need Direct-only rewrite
SETUP.md may need Direct-only rewrite
```

Runtime cleanup is complete for the currently verified Direct Realtime baseline.

---

## 22. Commercial Direction

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

## 23. Work Rules

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


---

## 24. Simplified Voice Status Indicators Runtime Baseline

Commit:

```text
d94ee70 Simplify voice status indicators
```

The Voice page now exposes simplified user-facing runtime status:

```text
Session: OFF / STARTING / ON / RECONNECTING
Activity: Idle / Listening / Speaking
```

Visible DOM elements:

```text
sessionStatus
activityStatus
```

Hidden technical DOM elements preserved:

```text
sttStatus
rtStatus
listenStatus
speakStatus
```

Runtime mapping:

```text
setDirectStatusOn(false)
  -> hidden sttStatus = DIRECT: OFF
  -> visible sessionStatus = Session: OFF

setDirectStatusOn(false, "DIRECT: STARTING")
  -> hidden sttStatus = DIRECT: STARTING
  -> visible sessionStatus = Session: STARTING

setDirectStatusOn(true)
  -> hidden sttStatus = DIRECT: ON
  -> visible sessionStatus = Session: ON

setRealtimeStatus("ON")
  -> hidden rtStatus = REALTIME: ON
  -> visible sessionStatus = Session: ON

setRealtimeStatus("RECONNECTING")
  -> hidden rtStatus = REALTIME: RECONNECTING
  -> visible sessionStatus = Session: RECONNECTING

setRealtimeStatus("OFF")
  -> hidden rtStatus = REALTIME: OFF
  -> visible sessionStatus = Session: OFF only when Direct Realtime is not active/starting
```

Activity mapping:

```text
setListeningIndicator(true)
  -> hidden listenStatus = active/ok
  -> visible activityStatus = Activity: Listening unless assistant speaking is active

setListeningIndicator(false)
  -> hidden listenStatus = inactive/bad
  -> visible activityStatus = Activity: Idle unless assistant speaking is active

setSpeakingIndicator(true)
  -> hidden speakStatus = active/ok
  -> visible activityStatus = Activity: Speaking

setSpeakingIndicator(false)
  -> hidden speakStatus = inactive/bad
  -> visible activityStatus = Activity: Idle unless listening is active
```

Current UI rule:

```text
The normal Voice page UI should show only Session and Activity.
The older DIRECT / REALTIME / LISTENING / SPEAKING pills are hidden but intentionally retained.
```

Diagnostic compatibility rule:

```text
Do not remove sttStatus, rtStatus, listenStatus, or speakStatus from the DOM or renderer logic without a separate diagnostics/debug UI decision.
They remain useful for troubleshooting Direct Realtime capture, websocket connectivity, input speech detection, and assistant playback state.
```

Validation:

```text
node --check Desktop/renderer/renderer.js: OK
Runtime test: OK
Initial state shows Session: OFF and Activity: Idle.
Start Direct Realtime shows Session: STARTING then Session: ON.
Incoming audio/speech detection shows Activity: Listening.
Assistant output playback shows Activity: Speaking.
Stop Direct Realtime returns to Session: OFF and Activity: Idle.
```

Boundaries:

```text
This change is UI status simplification only.
It does not change loopback/system audio capture.
It does not change Realtime websocket behavior.
It does not change provider adapters or session.update payloads.
It does not change Cost Guard behavior.
It does not change scenario/instruction behavior.

```

---

24. Realtime Turn Detection and Runtime Barge-in Baseline

Completed commits:

```text
24ee869 Tune realtime server VAD settings
b77ab7c Avoid stopping audio on every speech start
c9bc147 Use runtime audio state for barge-in detection
```

Runtime issue investigated:

```text
With Direct Realtime using loopback/system audio, external audio player content was being sent to the model correctly.
However, provider server VAD was originally segmenting external/system audio into many short speech_started / speech_stopped / committed cycles.
The Desktop renderer also originally stopped local playback on every speech_started event regardless of whether assistant playback was active.
```

Important finding:

```text
The tested logs did not prove that the model was hearing its own headphone output.
When Repeat Last Answer was run without external source audio, the assistant returned RT_AUDIO chunks and Direct Realtime response done without speech_started during playback.

The proven issue was:
- provider server_vad was too eager for the system audio/player use case before tuning
- renderer.js was too aggressive because speech_started always called stopAudioNow()
- using the UI speaking indicator alone as the barge-in condition was not reliable enough because local AudioContext playback can still have scheduled/active audio sources after visible speaking state changes
```

Current provider VAD configuration:

```text
Files:
- backend/providers/openai_realtime.py
- backend/providers/azure_openai_realtime.py
```

Both provider adapters now send:

```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.6,
    "prefix_padding_ms": 500,
    "silence_duration_ms": 1500,
    "create_response": True,
    "interrupt_response": True,
}
```

Interpretation:

```text
threshold: 0.6
  reduces sensitivity to minor signal changes.

prefix_padding_ms: 500
  preserves short context before detected speech begins.

silence_duration_ms: 1500
  prevents short pauses in external/system audio from ending a turn too quickly.

create_response: True
  provider still creates a response after committed input.

interrupt_response: True
  provider-side interruption behavior remains enabled for this phase.
```

Current renderer barge-in behavior:

```text
File:
Desktop/renderer/renderer.js
```

Original behavior:

```javascript
if (logText.includes("input_audio_buffer.speech_started")) {
  directLastSpeechStartedAt = Date.now();
  setListeningIndicator(true);
  stopAudioNow();
  if (speakStatusEl && speakStatusEl.classList.contains("ok")) {
    try { rtWs.send(JSON.stringify({ type: "response.cancel" })); } catch {}
    setAssistantSpeaking(false);
    push("Barge-in detected: cancelled current response and stopped local playback");
  }
}
```

Intermediate behavior from b77ab7c:

```javascript
if (logText.includes("input_audio_buffer.speech_started")) {
  directLastSpeechStartedAt = Date.now();
  setListeningIndicator(true);
  if (speakStatusEl && speakStatusEl.classList.contains("ok")) {
    stopAudioNow();
    try { rtWs.send(JSON.stringify({ type: "response.cancel" })); } catch {}
    setAssistantSpeaking(false);
    push("Barge-in detected: cancelled current response and stopped local playback");
  }
}
```

Final current behavior from c9bc147:

```javascript
if (logText.includes("input_audio_buffer.speech_started")) {
  directLastSpeechStartedAt = Date.now();
  setListeningIndicator(true);
  const hasAssistantAudio =
    isAssistantSpeaking ||
    activePlaybackSources.size > 0 ||
    audioQueue.length > 0 ||
    bufferedBytes > 0;
  if (hasAssistantAudio) {
    stopAudioNow();
    try { rtWs.send(JSON.stringify({ type: "response.cancel" })); } catch {}
    setAssistantSpeaking(false);
    push("Barge-in detected: cancelled current response and stopped local playback");
  }
}
```

Behavior rule:

```text
speech_started while assistant audio is not active:
  update Direct runtime input activity and Cost Guard timestamp only.
  do not call stopAudioNow().

speech_started while assistant audio is active:
  treat as barge-in.
  stop local playback.
  send response.cancel.
  clear assistant speaking state.
```

Runtime assistant-audio detection rule:

```text
The renderer must not rely only on the UI speaking indicator for barge-in decisions.

Barge-in now uses runtime audio state:
- isAssistantSpeaking
- activePlaybackSources.size
- audioQueue.length
- bufferedBytes

Reason:
AudioContext playback can have scheduled or active BufferSource nodes even when the UI speaking indicator alone is not a reliable reflection of remaining local playback.
activePlaybackSources.size is the most important runtime indicator for scheduled/active local assistant audio.
audioQueue.length and bufferedBytes cover paused/buffered assistant audio.
```

Runtime validation evidence:

```text
Before VAD tuning:
  external audio player input produced many short speech_started / speech_stopped / committed cycles.

After VAD tuning:
  external audio player input produced a longer speech interval:
  speech_started
  approximately 22 seconds of input
  speech_stopped
  committed
  RT_AUDIO response chunks
  Direct Realtime response done

After b77ab7c:
  initial speech_started during input did not log Audio stopped immediately.
  RT_AUDIO response streamed normally.
  Repeat Last Answer streamed normally.
  However, barge-in during assistant playback was sometimes unreliable because the condition depended only on speakStatusEl.

After c9bc147:
  speech_started while assistant audio is inactive still does not stop local playback.
  speech_started while assistant local playback is active reliably stops local playback and logs barge-in behavior.
  Runtime test passed after changing the condition to use actual assistant audio state.
```

Known non-blocking observation:

```text
A response.cancel sent during barge-in may produce:
ERROR(Realtime): Cancellation failed: no active response found

This occurs when the provider response is already completed by the time cancel is processed.
It is not currently treated as a failed runtime test because local playback had already been stopped.
```

Validation commands:

```powershell
cd C:\Projects\chatt-direct

python -m py_compile backend/providers/openai_realtime.py backend/providers/azure_openai_realtime.py
node --check .\Desktop\renderer\renderer.js
git status --short
git diff --name-status
git diff --stat
```

Confirmed validation:

```text
backend/providers/openai_realtime.py py_compile: OK
backend/providers/azure_openai_realtime.py py_compile: OK
Desktop/renderer/renderer.js node --check: OK
Runtime test with system audio/player input: OK
Runtime Repeat Last Answer test: OK
Runtime barge-in test with active assistant playback: OK
Commit 24ee869 Tune realtime server VAD settings: OK
Commit b77ab7c Avoid stopping audio on every speech start: OK
Commit c9bc147 Use runtime audio state for barge-in detection: OK
```

Runtime boundaries:

```text
No microphone input was introduced.
Loopback/system/browser audio remains the only Direct Realtime input path.
PCM16 24k mono path remains unchanged.
Playback path and selected headphones/output sink remain unchanged.
Audio Output Safety remains unchanged.
Cost Guard still uses directLastSpeechStartedAt based on speech_started.
Provider selection and session.update structure remain provider-adapter owned.
No native Windows process-loopback isolation was added in this phase.
No AEC (Acoustic Echo Cancellation) was added in this phase.
This change keeps interrupt_response: True for this phase.
```

Future investigation boundary:

```text
Do not treat model self-hearing as proven unless a controlled test shows speech_started during assistant-only output with no external source audio.
If system loopback isolation is required later, evaluate native Windows Application Loopback / Process Loopback with "exclude our app process tree" as a separate architecture phase.
If false barge-in while assistant audio is active remains frequent, evaluate a controlled 300-500 ms delayed/manual barge-in strategy only after the current runtime-audio-state baseline remains stable.
```

## 26. Azure Licensing / Trial Runtime Baseline

Licensing/trial is now an implemented commercial access layer foundation for AnswerDesk AI / CHATT Direct.

Commercial model:

```text
AnswerDesk AI is a downloadable Windows desktop application.
AnswerDesk AI is not a hosted AI SaaS service.
AnswerDesk AI does not sell AI model access, AI endpoint access, hosting of conversations, or AI usage credits.
The customer brings their own AI provider/API key.
The license unlocks use of the desktop application only.
Provider/API usage remains owned and paid by the customer directly through their selected provider.
```

Payment provider decision:

```text
Payment provider is not finalized.
Paddle remains a candidate.
Lemon Squeezy remains a candidate.
Do not treat Paddle as the decided primary provider.
Do not treat Lemon Squeezy as inactive.
Desktop code must not be hardcoded to either payment provider.
Desktop must communicate only with the hosted licensing backend.
Payment provider webhooks will be handled by the hosted licensing backend later.
```

Current Azure licensing infrastructure:

```text
Subscription ID:
8794fa81-0ce6-4fd6-9d1b-ccfa160df329

Tenant ID:
b7fddbde-dfdf-425e-a785-97d3b91909a0

Resource Group:
AI

Region:
East US 2 / eastus2

Storage Account:
answerdesklicdevst

Azure Function App:
answerdesk-licensing-api-dev

Default host:
answerdesk-licensing-api-dev.azurewebsites.net

Application Insights:
answerdesk-licensing-api-dev

Azure Table:
LicenseRecords
```

Current hosted licensing API base URL:

```text
https://answerdesk-licensing-api-dev.azurewebsites.net/api
```

Current deployed licensing API endpoints:

```text
GET  /v1/license/health
POST /v1/license/trial/start
POST /v1/license/validate
POST /v1/license/activate
```

Current local licensing API source folder:

```text
C:\Projects\chatt-direct\apps\licensing-api
```

Current licensing API files:

```text
apps/licensing-api/package.json
apps/licensing-api/package-lock.json
apps/licensing-api/host.json
apps/licensing-api/local.settings.example.json
apps/licensing-api/README.md
apps/licensing-api/src/functions/health.js
apps/licensing-api/src/functions/trialStart.js
apps/licensing-api/src/functions/validate.js
apps/licensing-api/src/functions/activate.js
apps/licensing-api/src/shared/responses.js
apps/licensing-api/src/shared/licenseStatuses.js
apps/licensing-api/src/shared/validation.js
apps/licensing-api/src/shared/storage.js
apps/licensing-api/src/shared/email.js
```

Current Azure Function runtime:

```text
Azure Functions v4
Node.js 24 on Azure Function App
Local package engine currently allows node >=20
@azure/functions
@azure/data-tables
@azure/communication-email
```

Current Azure app settings used by licensing API:

```text
LICENSE_STORAGE_CONNECTION_STRING
LICENSE_TABLE_NAME=LicenseRecords
EMAIL_ENABLED
ACS_CONNECTION_STRING
ACS_EMAIL_FROM_ADDRESS
ACS_EMAIL_FROM_NAME
```

Security note:

```text
Do not paste or commit LICENSE_STORAGE_CONNECTION_STRING, ACS_CONNECTION_STRING, storage account keys, API keys, tokens, webhook secrets, or payment provider secrets.
A storage account connection string was displayed during setup in the terminal/chat flow.
Key rotation is deferred to the later security hardening/check phase per user decision.
Before production or public release, rotate exposed keys and complete a full secret scan.
```

Trial/license authority rule:

```text
The hosted licensing backend is authoritative for trial/license state.
The Desktop app may cache license state locally.
The local cache is not authoritative.
The 3-day free trial is registered and validated through the hosted Azure Licensing API.
Azure Table Storage is the current MVP persistence layer for trial records, lookup records, and trial/start rate-limit records.
```

Current Desktop licensing state:

```text
Dedicated License page exists in the Desktop app.
License page shows current cached/backend license status.
License page supports:
- Start 3-day Trial
- Activate License
- Refresh License Status
- Buy License

License page is separate from Settings.
Settings no longer contains the License & Trial card.
Renderer calls only window.electronAPI.license.*.
Electron main performs hosted licensing API calls over HTTPS.
```

Current Desktop License page navigation:

```text
Voice
License
Settings
Scenarios
```

Current local licensing cache:

```text
<Electron userData>\license_state.json
```

Runtime storage note:

```text
license_state.json follows the same Electron userData runtime pattern.
In development it is created under Desktop\.electron-userdata\.
In packaged Windows it is expected under AppData\Roaming\answerdesk-ai\.
```

Current Desktop device identity behavior:

```text
Desktop/electron/main.cjs generates a stable licensing deviceHash.
On Windows, Electron main attempts to read Windows MachineGuid using reg.exe query.
Raw MachineGuid is never stored, never logged, and never sent to Azure.
The value sent to Azure is SHA-256("answerdesk-ai-device-v1:" + MachineGuid).
If MachineGuid cannot be read, Electron main creates a stable fallback device_seed file under Electron userData and derives the SHA-256 deviceHash from that fallback seed.
Existing non-empty deviceHash in license_state.json is preserved and not regenerated unnecessarily.
```

Current license cache schema:

```json
{
  "schemaVersion": 1,
  "installId": "uuid",
  "deviceHash": "sha256 hex string or null before backfill",
  "status": "not_registered",
  "registeredEmail": null,
  "licenseId": null,
  "activationId": null,
  "licenseKeyLast4": null,
  "trialStartedAt": null,
  "trialExpiresAt": null,
  "licenseActivatedAt": null,
  "lastValidatedAt": null,
  "serverTime": null,
  "offlineGraceExpiresAt": null,
  "lastError": null,
  "checkoutUrl": null,
  "paymentProvider": null,
  "statusSignature": null,
  "updatedAt": "ISO timestamp"
}
```

Raw license key rule:

```text
Do not store raw license keys locally.
Desktop may send raw licenseKey only to POST /v1/license/activate.
The hosted licensing API currently stores/returns only licenseKeyLast4.
```

Current supported licensing statuses:

```text
not_registered
trial_active
trial_expired
licensed
license_invalid
license_revoked
offline_grace
rate_limited
error
```

Current Azure Table Storage model:

```text
Main trial/license record:
PartitionKey = license
RowKey = installId

Email lookup:
PartitionKey = email
RowKey = emailHash

Device lookup:
PartitionKey = device
RowKey = deviceHash

Rate-limit records:
PartitionKey = rate
RowKey = trialStart:email:<emailHash>
RowKey = trialStart:device:<deviceHash>
```

Main record fields include:

```text
installId
registeredEmail
emailHash
deviceHash
status
trialStartedAt
trialExpiresAt
licenseId
activationId
licenseKeyLast4
licenseActivatedAt
lastValidatedAt
offlineGraceExpiresAt
checkoutUrl
paymentProvider
createdAt
updatedAt
```

Trial anti-reset behavior:

```text
Trial duration: 3 days.
Trial email: required for Start 3-day Trial.
trial/start normalizes email and computes emailHash = SHA-256(normalizedEmail).
trial/start receives deviceHash from Desktop; Desktop sends only the hashed value.
trial/start checks existing trial/license state in this order:
1. installId main record
2. emailHash lookup
3. deviceHash lookup

If any of those identities already has a trial/license record:
- no new trial is created
- trialStartedAt is not reset
- trialExpiresAt is not extended
- existing registeredEmail is not overwritten
- missing emailHash/deviceHash fields may be backfilled
- missing lookup records may be created when safe
- current status is returned based on server time and trialExpiresAt

If no installId/emailHash/deviceHash match exists:
- a new trial_active record is created
- trialStartedAt is server time
- trialExpiresAt is server time + 3 days
- email and device lookup records are created
```

Current Trial Started email behavior:

```text
When trial/start creates a new trial record, the hosted licensing API sends a Trial Started email through Azure Communication Services Email.
The email is sent only for a newly created trial record.
The email is not sent when trial/start returns an existing trial/license record through installId, emailHash, or deviceHash lookup.
Email sending is best-effort.
If email sending fails, trial/start still returns the normal response.
Email failure is logged with console.warn for Application Insights visibility.
```

Current trial/start rate limiting:

```text
Endpoint:
POST /v1/license/trial/start

Limit:
10 attempts per 1 hour

Identities:
emailHash
deviceHash when present

Storage:
PartitionKey = rate
RowKey = trialStart:email:<emailHash>
RowKey = trialStart:device:<deviceHash>

Fields:
count
windowStartedAt
updatedAt

If either emailHash or deviceHash exceeds the limit:
ok = false
status = rate_limited
message = Too many trial attempts. Please try again later.
```

Current validate behavior:

```text
validate currently reads by installId.
validate returns trial_active while server time is before trialExpiresAt.
validate returns trial_expired when server time is at or after trialExpiresAt.
validate returns licensed only if a stored record is already licensed.
validate does not return emailHash or deviceHash to Desktop.
```

Current activate behavior:

```text
Payment-backed license activation is not connected yet.
activate validates email, licenseKey, and installId.
activate never stores or returns the raw licenseKey.
activate stores/returns licenseKeyLast4 only.
activate may store normalized registeredEmail, emailHash, deviceHash, and licenseKeyLast4.
activate preserves existing trial status if a trial record exists.
activate does not mark a record licensed yet.
```

Current access/enforcement rule:

```text
Start Direct Realtime is intentionally not license-gated during current development and packaging validation.
The License page, hosted licensing API, local cache, Azure Table Storage flow, anti-reset protection, and trial/start rate limiting are active.
The enforcement call inside startDirectRealtime() remains disabled/bypassed for now.
Do not re-enable Start Direct Realtime blocking until explicitly approved.
Future production enforcement is expected to allow only trial_active and licensed.
```

Future allow/block rule when enforcement is explicitly re-enabled:

```text
Allow Start Direct Realtime only when license status is:
- trial_active
- licensed

Block Start Direct Realtime when license status is:
- not_registered
- trial_expired
- license_invalid
- license_revoked
- offline_grace
- rate_limited
- error
```

Offline grace rule:

```text
Offline grace is not implemented in the current MVP.
offlineGraceExpiresAt remains in schema for future use.
For now, hosted backend validation remains the authority.
```

Current implementation commits:

```text
8ebdefa Update canonical state for licensing plan
0e91a2e Add local license state foundation
5097d7a Correct canonical userData runtime paths
9450655 Add license trial settings UI
b61ebee Move licensing to dedicated page
414b8c0 Add licensing API skeleton
878eb08 Connect desktop licensing to Azure API
6dc4ad1 Add licensing trial storage
0963d78 Update canonical state for licensing API storage
388e36f Add desktop licensing device hash
2bfb801 Add trial anti-reset protection
1fb6a01 Add trial start rate limiting
5a917d7 Add trial started email delivery
```

Current endpoint validation results:

```text
GET /v1/license/health:
  OK, returns ok:true, status:healthy.

POST /v1/license/trial/start:
  OK, creates trial_active record with trialStartedAt and trialExpiresAt for a new installId/emailHash/deviceHash.

POST /v1/license/validate:
  OK, reads trial record and returns trial_active while active.

POST /v1/license/trial/start for same installId:
  OK, does not extend trialStartedAt/trialExpiresAt.

POST /v1/license/trial/start for same emailHash with new installId:
  OK, does not create a new trial and returns the original trial record.

POST /v1/license/trial/start for same deviceHash with new installId and different email:
  OK, does not create a new trial and returns the original trial record.

POST /v1/license/trial/start for same deviceHash with different email:
  OK, preserves the original registeredEmail and does not overwrite it.

POST /v1/license/trial/start repeated 11 times for same emailHash/deviceHash:
  OK, attempts 1-10 return trial_active; attempt 11 returns rate_limited.

POST /v1/license/activate:
  OK for skeleton behavior, returns ok:false with Payment-backed license activation is not connected yet, preserves trial status, returns only licenseKeyLast4.

POST /v1/license/trial/start after Trial Started email implementation:
  OK for new test email/installId/deviceHash, returns trial_active with message Trial started.
  Trial Started email delivered through Azure Communication Services Email.
  Existing-trial path does not send a duplicate Trial Started email.
```

Current Desktop end-to-end validation:

```text
Desktop License page successfully calls hosted Azure Licensing API through Electron main.
Azure Licensing API writes/reads Azure Table Storage LicenseRecords.
Desktop License page displays Trial Active after Start 3-day Trial.
Desktop License page displays registered email, Trial Expires, and Last Validated.
Start Direct Realtime still works without license gating during development.
Git clean after validation and commit.
```

Current licensing implementation boundaries:

```text
Licensing backend is separate from backend/app_realtime.py.
backend/app_realtime.py remains the local Direct Realtime runtime backend only.
Desktop renderer does not call Azure directly.
Renderer calls window.electronAPI.license.* only.
Electron main owns hosted licensing API calls.
Payment provider logic is not in Desktop.
Paddle/Lemon Squeezy webhook logic is not implemented yet.
```

Provider-neutral checkout rule:

```text
Buy License opens a configurable checkoutUrl or pricing page.
checkoutUrl may be returned by the licensing backend and cached in license_state.json.
Desktop must not assume Paddle-specific or Lemon-specific checkout behavior.
Current checkoutUrl is null, so Buy License reports that checkout URL is not configured yet.
```


## 27. Licensing Operations / Monitoring / Support / Email Delivery Baseline

This section captures the current minimal operational model for Azure Licensing API monitoring, licensing support troubleshooting, customer email delivery, and future support tooling.

Licensing operations scope:

```text
This scope applies to the hosted Azure Licensing API, Azure Table Storage LicenseRecords, Application Insights, Azure Monitor alerts, and Azure Communication Services Email.
It does not change Direct Realtime runtime, Desktop audio flow, provider adapters, scenario behavior, Mini Control Window, or backend/app_realtime.py.
```

### Current Licensing Operations MVP

The current licensing operations model is intentionally minimal and uses Azure-native tooling instead of a custom admin portal.

Current operational tools:

```text
Azure Portal
  Used for Function App health, configuration, deployment status, and resource overview.

Application Insights
  Used for Failures, Search, request tracing, exceptions, dependency failures, licenseTrialStart traces, and licenseValidate traces.

Storage browser / Azure Storage Explorer
  Used for read-only lookup into Azure Table Storage LicenseRecords.

Azure Monitor Action Group
  Used for alert email notification.
```

Current verified monitoring state:

```text
Application Insights telemetry is active for answerdesk-licensing-api-dev.
Failures view showed 0 failed requests during validation.
Search showed licenseValidate traces and licenseTrialStart traces.
licenseValidate calls were successful during validation.
licenseTrialStart calls were successful during validation.
Storage browser showed LicenseRecords records for PartitionKey = license.
Storage browser showed trial/start rate records for PartitionKey = rate.
```

Current alerting setup:

```text
Action Group:
ag-answerdesk-licensing-alerts

Notification:
Email receiver configured for internal licensing alerts.

Alert rule:
alert-answerdesk-licensing-failed-requests
Signal: Failed requests
Condition: Count greater than 0
Severity: 2 - Warning
Scope: Application Insights answerdesk-licensing-api-dev

Availability test:
health-answerdesk-licensing-api
URL: https://answerdesk-licensing-api-dev.azurewebsites.net/api/v1/license/health
Frequency: 5 minutes
Success condition: HTTP 200
Action Group: ag-answerdesk-licensing-alerts

Storage alert rule:
alert-answerdesk-storage-availability
Scope: Storage account answerdesklicdevst
Signal: Availability
Condition: Average less than 90
Action Group: ag-answerdesk-licensing-alerts
Severity: 2 - Warning
```

Alert behavior:

```text
Azure Monitor alerts do not automatically fix issues.
When an alert triggers, Azure Monitor activates the Action Group and sends email.
The operator then opens Application Insights, Failures/Search, and Storage browser to determine the failing component.
```

### Licensing Support Runbook v1

When a user reports a licensing issue, support should check the following in order.

Support check order:

```text
1. Check health endpoint availability in Application Insights Availability.
2. Check Application Insights Failures for failed requests, exceptions, and dependency failures.
3. Use Application Insights Search for licenseTrialStart and licenseValidate around the reported time.
4. Check LicenseRecords with PartitionKey = license and RowKey = installId.
5. Check LicenseRecords with PartitionKey = rate for trial/start rate-limit records.
6. Check Storage Account availability alert state if storage errors are suspected.
7. Classify the issue as user state, rate limit, trial expiration, API failure, storage failure, or activate skeleton behavior.
```

Data to request from the user for licensing support:

```text
Email used for trial/license.
Screenshot of Desktop License page if useful.
installId from Desktop License page.
Exact error message.
Approximate time when the problem happened.
```

Data not to request from the user:

```text
API keys.
Raw license key unless strictly required for a controlled activation test.
MachineGuid.
Provider credentials.
Storage connection strings.
Manual logs unless a later diagnostic package flow is implemented.
```

Common support interpretations:

```text
trial_active
  Trial exists and is active. User may need Refresh License Status in Desktop.

trial_expired
  Trial exists but trialExpiresAt is in the past. Do not reset automatically.

rate_limited
  User exceeded trial/start attempt limit. Check PartitionKey = rate records.

no record
  No record exists for the supplied installId; check if wrong installId/email was supplied.

API failure
  Application Insights Failures/Search shows failed request or exception.

storage failure
  Application Insights dependency failure or Storage availability alert indicates storage issue.

activate issue
  Expected in current phase because paid activation is skeleton-only.
```

### Application Troubleshooting Direction

Application troubleshooting is separate from licensing operations.

Current decision:

```text
Do not build a full Support Center portal for app troubleshooting in the MVP.
Do not continuously monitor or stream user data from the Desktop app.
Do not implement remote-control support behavior.
```

Preferred MVP app troubleshooting approach:

```text
Export Troubleshooting Package
```

User-initiated diagnostic package flow:

```text
User has an app problem.
User clicks Export Troubleshooting Package or Send Troubleshooting Data.
Desktop app shows exactly what data will be included.
User confirms.
For MVP, app creates a local JSON/ZIP package.
User sends it to support manually by email.
Support analyzes the package.
```

Future optional online diagnostic upload flow:

```text
User has an app problem.
User clicks Send Troubleshooting Data.
Desktop app shows exactly what data will be sent.
User confirms.
Diagnostic package uploads to a Support Center backend.
Operator reviews the case and gives instructions.
Diagnostic data is used to improve future releases.
```

Allowed diagnostic data candidates:

```text
installId
appVersion
license status
provider type
provider configured yes/no
last provider test result
backend status
Realtime WebSocket status
last sanitized errors
last sanitized log lines
Windows version
app mode: installed/dev
timestamp
```

Forbidden diagnostic data:

```text
Provider API keys.
Azure/OpenAI keys.
Raw audio.
Conversation transcript.
Full prompts/instructions.
MachineGuid.
Raw license key.
Personal files.
Provider endpoint secrets.
Storage connection strings.
```

### Future Licensing Admin Web App Direction

A full support center is not justified for MVP, but a minimal licensing admin portal may be useful later because licensing data lives in Azure.

Future minimal internal licensing admin app direction:

```text
Azure Static Web App or Azure App Service
+ Microsoft Entra ID login
+ Admin API endpoints in existing Azure Function App
```

Phase 1 scope for future admin portal:

```text
Read-only only.
LicenseRecords search by email/installId/deviceHash/licenseId later.
Trial status view.
Record detail view.
Rate-limit view.
Health/Application Insights links.
No data modification.
```

Actions forbidden in admin portal v1:

```text
No reset trial.
No delete record.
No manual activation.
No revoke.
No user edits.
No paid license lifecycle actions.
```

If write actions are added later, requirements are:

```text
Microsoft Entra ID authentication.
Role-based access control.
Audit log.
Reason required for every write action.
Timestamp.
Admin user identity.
```

### Customer Email Delivery Baseline

Azure Communication Services Email is now the selected Azure-native email service for MVP transactional product emails.

Current Azure email resources:

```text
Email Communication Services resource:
answerdesk-email-dev

Communication Services resource:
answerdesk-comm-dev

Azure managed domain:
005a7e94-3e60-4be6-a1db-d174298e9946.azurecomm.net

MailFrom:
DoNotReply@005a7e94-3e60-4be6-a1db-d174298e9946.azurecomm.net

Display name tested:
DoNotReply / AnswerDesk AI depending on sender configuration
```

Current domain state:

```text
Azure managed domain deployed.
Domain status verified.
SPF verified.
DKIM verified.
DKIM2 verified.
Domain connected to answerdesk-comm-dev.
Azure portal test email succeeded.
```

Current Function App email app settings:

```text
EMAIL_ENABLED=true
ACS_CONNECTION_STRING=<secret in Function App settings>
ACS_EMAIL_FROM_ADDRESS=DoNotReply@005a7e94-3e60-4be6-a1db-d174298e9946.azurecomm.net
ACS_EMAIL_FROM_NAME=AnswerDesk AI
```

Security rule:

```text
ACS_CONNECTION_STRING is a secret.
Do not paste it into chat.
Do not commit it.
Do not expose it to Desktop.
Store it only in Azure Function App settings / secure deployment configuration.
```

Current implemented email behavior:

```text
MVP email type:
Trial Started email only.

Trigger:
POST /v1/license/trial/start creates a new trial record.

Do not send:
If trial/start returns an existing trial/license record.
If anti-reset lookup finds existing installId/emailHash/deviceHash.
If EMAIL_ENABLED is not true.
If required email configuration is missing.

Best-effort behavior:
Email sending must not break trial/start.
If email fails, trial/start still returns the normal response.
Email failure is logged with console.warn so Application Insights can capture it.
```

Current licensing API email implementation:

```text
Dependency added:
@azure/communication-email

New file:
apps/licensing-api/src/shared/email.js

Updated file:
apps/licensing-api/src/functions/trialStart.js

Function:
sendTrialStartedEmailBestEffort(record)

Commit:
5a917d7 Add trial started email delivery
```

Current Trial Started email content:

```text
Subject:
AnswerDesk AI trial started

Body:
Your 3-day AnswerDesk AI trial has started.
Trial expires: <trialExpiresAt>
Thank you for trying AnswerDesk AI.
```

Current email validation:

```text
Azure Communication Services test email from portal: OK.
Function App settings added: OK.
Licensing API deployed successfully after code change: OK.
GET /v1/license/health after deployment: OK.
POST /v1/license/trial/start with new test email/installId/deviceHash: OK.
New trial response returned message Trial started.: OK.
Trial Started email delivered to test inbox: OK.
```

Known production issue:

```text
Azure managed sender works technically but can land in spam.
For production/public release, configure a custom domain such as itprofessional.org.
Use a professional sender such as support@itprofessional.org or noreply@itprofessional.org.
Verify SPF/DKIM/DKIM2 for the custom domain.
Improve email template before public release.
```

Future customer email candidates:

```text
Trial expiring soon.
Trial expired.
License activated.
License revoked/disabled.
Support/troubleshooting response.
Payment/renewal emails, depending on selected payment provider.
```

Boundary with Azure Monitor alerts:

```text
Azure Monitor operational alerts use Azure Monitor Action Groups.
Customer/product transactional emails use Azure Communication Services Email.
These are separate email paths.
```


Planned future hosted API endpoints:

```text
POST /v1/license/deactivate      # later
POST /v1/webhooks/paddle         # later, if Paddle is selected or supported
POST /v1/webhooks/lemon          # later, if Lemon Squeezy is selected or supported
```

Remaining licensing work:

```text
Integrate payment provider after decision: Paddle, Lemon Squeezy, or both.
Implement paid license issuing/activation model.
Implement webhook signature validation.
Implement provider-neutral checkoutUrl generation or pricing page.
Implement production Start Direct Realtime license enforcement when approved.
Implement trial expiration UX/countdown if desired.
Implement license revocation/deactivation/reset device behavior.
Implement offline grace only after explicit approval.
Implement storage key rotation and secret scan before production/public release.
Configure custom email domain such as itprofessional.org before production/public release.
Improve customer email templates before production/public release.
Add admin/customer license management only after core paid activation is defined.
```

Validation after Desktop licensing changes:

```powershell
cd C:\Projects\chatt-direct
node --check .\Desktop\electron\main.cjs
node --check .\Desktop\electron\preload.cjs
node --check .\Desktop\renderer\renderer.js
git status --short
git diff --name-status
git diff --stat
```

Validation after licensing API changes:

```powershell
cd C:\Projects\chatt-direct\apps\licensing-api
node --check .\src\functions\health.js
node --check .\src\functions\trialStart.js
node --check .\src\functions\validate.js
node --check .\src\functions\activate.js
node --check .\src\shared\responses.js
node --check .\src\shared\licenseStatuses.js
node --check .\src\shared\validation.js
node --check .\src\shared\storage.js
node --check .\src\shared\email.js
```

Deploy licensing API:

```powershell
cd C:\Projects\chatt-direct\apps\licensing-api
func azure functionapp publish answerdesk-licensing-api-dev --javascript
```

Runtime test URLs:

```text
https://answerdesk-licensing-api-dev.azurewebsites.net/api/v1/license/health
https://answerdesk-licensing-api-dev.azurewebsites.net/api/v1/license/trial/start
https://answerdesk-licensing-api-dev.azurewebsites.net/api/v1/license/validate
https://answerdesk-licensing-api-dev.azurewebsites.net/api/v1/license/activate
```

Licensing must not change:

```text
Direct Realtime audio flow
loopback/system/browser audio capture
microphone prohibition
provider adapters
Realtime WebSocket path
scenario preset logic
selected output/headphones playback
Cost Guard behavior
Mini Control Window runtime ownership
instruction refresh WebSocket message shape
backend/app_realtime.py Realtime bridge behavior
```