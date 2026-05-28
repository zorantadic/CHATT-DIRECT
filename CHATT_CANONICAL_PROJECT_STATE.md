CHATT Canonical Project State
Last updated: 2026-05-25
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
Direct Realtime voice
multi-provider Realtime adapter runtime
Azure OpenAI Realtime and OpenAI Realtime support
Azure OpenAI Realtime uses gpt-realtime-2 through the OpenAI-compatible /openai/v1/realtime endpoint
BYOK provider/API configuration
capability-driven provider setup
selected provider voice applied in Realtime session.update
outgoing language steering through final Realtime instructions
incoming language planned as transcription language hint
packaged Windows app
version 0.1.8 packaged installer
minimized-app floating mini control window
deterministic Electron UI zoom factor 0.7 applied in main window runtime
```
Primary value:
```text
stable Direct Realtime voice workflow
low latency
headphones/output-device routing
clean local setup
user-owned provider credentials
real provider connection validation
capability-driven voice/language/region setup
multilingual conversation stabilization
workflow-specific voice assistant use cases
scenario preset based behavior selection
Scenarios tab with one-click assistant behavior selection
compact clickable scenario cards with selected-state styling
hover details popup for scenario human-readable explanation
Voice page selected scenario visibility
modern dark glass Desktop UI across Voice, Settings, and Scenarios
responsive default Desktop window size 1120 x 820 with minimum 860 x 720
deterministic UI scale independent of Chromium persisted profile zoom state
multilingual UI display support
header language selector synchronized with Settings language selector
floating vertical mini control window when main app is minimized
mini control supports Start, Stop, Refresh, Repeat, Reset, Open, Session, and Activity
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
-> active Realtime provider adapter
-> Azure OpenAI Realtime or OpenAI Realtime session
-> Azure provider uses OpenAI-compatible /openai/v1/realtime for gpt-realtime-2
-> provider-specific session.update payload
-> selected provider voice applied in session.update
-> outgoing language rule appended to final session instructions
-> provider VAD/interruption behavior
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
Desktop/package-lock.json
Desktop/electron/main.cjs
Desktop/electron/preload.cjs
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/styles.css
Desktop/renderer/mini-control.html
Desktop/renderer/mini-control.css
Desktop/renderer/mini-control.js
Desktop/renderer/stt-worklet-processor.js
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
Current relevant Direct Realtime fallback/default settings:
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

Active provider configuration is saved locally in:
```text
backend/provider_config.local.json
```

Provider capability lists are defined in:
```text
backend/provider_capabilities.json
```

Current capability-driven setup includes:
```text
Azure OpenAI Realtime regions
Azure default model gpt-realtime-2
OpenAI/Azure voice lists
Incoming language list
Outgoing language list
```

This generated provider config file is ignored by Git and may contain user-owned provider credentials.
Do not commit real secrets.
The Desktop settings currently use only:
```text
Realtime HTTP
Realtime WS
Realtime rate
Playback volume
Output device
Session Cost Guard controls
Scenario & Instructions controls
modern dark glass Settings control-center layout
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
Azure OpenAI Realtime runtime test: OK
OpenAI Realtime runtime test: OK
OpenAI Realtime provider produced better natural voice quality during local testing
Start Direct Realtime: OK
Stop Direct Realtime: OK
Reset session while Direct Realtime is running: skipped without closing runtime
Reset session after Stop: creates a new session
Direct Realtime worked normally after final cleanup
Provider Adapter / Runtime Integration: OK
Saved provider config drives runtime provider selection: OK
Provider-specific session.update payload handling: OK
OpenAI Realtime session.type and audio.input.turn_detection schema compatibility: OK
Real provider network connection test for OpenAI Realtime: OK
Real provider network connection test for Azure OpenAI Realtime: OK
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
Dev profile zoom masking issue identified and resolved by deterministic app zoom approach: OK
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
---
12. Current Known Good State
Current known good local state:
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
14. Provider Adapter / Runtime Integration Baseline

Completed provider work:

```text
Provider Setup UI skeleton
Provider save UI and region dropdown
Provider test UI validation
Provider configuration API
Provider configuration schema
Realtime provider adapter structure
Azure Realtime provider adapter
OpenAI Realtime provider adapter
Runtime provider selection from saved config
Saved Azure provider config at runtime
Saved OpenAI provider config at runtime
Provider-specific session.update payload handling
Realtime provider error message normalization
Adapter-level provider config test
Real Realtime provider websocket network connection test
Expanded provider capability lists
Selected provider voice applied in Realtime session.update
Outgoing language rule added to final Realtime instructions
```

Current supported active providers:

```text
azure-openai-realtime
openai-realtime
```

Current runtime adapter files:

```text
backend/providers/base.py
backend/providers/__init__.py
backend/providers/azure_openai_realtime.py
backend/providers/openai_realtime.py
```

Current provider configuration files:

```text
backend/provider_capabilities.json
backend/provider_config.py
backend/provider_config.local.example.json
backend/provider_config.local.json   # generated locally and ignored by Git
```

Current provider API endpoints:

```text
GET  /v1/provider/capabilities
GET  /v1/provider/config
POST /v1/provider/config
GET  /v1/provider/active
POST /v1/provider/test
```

Current provider test behavior:

```text
POST /v1/provider/test performs required-field validation first.
If required fields are present, it performs a real Realtime websocket network probe.
The probe opens the configured provider websocket and closes immediately.
The probe does not send audio.
The probe does not send session.update.
The probe does not start Direct Realtime.
```

Confirmed provider test results:

```text
OpenAI Realtime websocket connection succeeded.
Azure OpenAI Realtime websocket connection succeeded.
```

Current provider runtime behavior:

```text
/voice/ws reads activeProvider from saved provider config.
The selected adapter builds provider URL and auth headers.
The selected adapter builds provider-specific session.update payload.
Selected provider voice is included in session.update.
Outgoing language is appended to final Realtime instructions as a language rule.
Desktop audio routing remains unchanged.
Loopback/system/browser audio remains the only allowed input source.
PCM16 24k mono audio path remains unchanged.
```

Important OpenAI compatibility finding:

```text
OpenAI Realtime requires session.type = "realtime".
OpenAI VAD config belongs under session.audio.input.turn_detection.
OpenAI does not accept Azure-style session.turn_detection.
```

Important Azure compatibility finding:

```text
Azure OpenAI Realtime now uses the OpenAI-compatible /openai/v1/realtime endpoint for gpt-realtime-2.
Azure provider no longer uses the legacy voice-agent/realtime URL for the current gpt-realtime-2 path.
Azure provider uses the OpenAI-compatible session.update shape with session.type = "realtime".
OpenAI provider uses the selected saved voice in session.audio.output.voice.
Azure provider uses the selected saved voice as the OpenAI-compatible audio output voice string.
Outgoing language is not a separate Realtime API field in this project; it is applied through instructions.
Incoming language is planned as a transcription language hint to stabilize input language recognition.
```

Recent provider integration commits:

```text
Add realtime provider adapter structure
Add Azure realtime provider adapter
Use Azure realtime provider adapter in voice runtime
Select realtime provider from saved config
Use saved config for Azure realtime provider
Enable OpenAI realtime provider factory
Use saved config for OpenAI realtime provider
Normalize realtime provider error messages
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

---
15. Language Steering Baseline

Current language design:

```text
Modern Realtime voice models are multilingual.
The project problem is not whether the model can speak multiple languages.
The project problem is stabilizing input language recognition and response language behavior.
```

Canonical language meanings:

```text
incomingLanguage
= transcription language hint
= tells the model which language to expect in the incoming audio
= speech recognition guidance, not response language control

outgoingLanguage
= response language guidance
= appended to the final session instructions
= tells the model which language to answer in
```

Current implemented behavior:

```text
Outgoing language is appended to effective Realtime instructions before session.update.
Existing instruction text remains unchanged in the Instruction tab.
The final session instruction sent to the model is:
current instruction + outgoing language rule.
Changing Outgoing language requires Save provider so the backend reads the saved provider config.
```

Current planned behavior:

```text
Incoming language should be added as provider-specific transcription language hint.
Do not treat incomingLanguage as translation mode.
Do not treat outgoingLanguage as a separate Realtime API language field unless provider documentation confirms it.
```

Do not introduce translation endpoint/runtime unless explicitly approved.

---
16. Scenario Presets Baseline

Scenario presets are now part of the product direction.

Current scenario preset architecture:

```text
install default file = read-only built-in template
runtime local file = user-editable scenario state
```

Current default scenario template file:

```text
backend/scenario_presets.json
```

Current local runtime scenario file for Phase 1 local/dev:

```text
backend/scenario_presets.local.json
```

The local runtime file is generated/seeded on first use and ignored by Git.

Current backend scenario environment variables:

```env
SCENARIO_PRESETS_PATH=scenario_presets.local.json
SCENARIO_PRESETS_DEFAULT_PATH=scenario_presets.json
```

Current backend scenario API:

```text
GET    /v1/scenarios
POST   /v1/scenarios/active
POST   /v1/scenarios/instruction
DELETE /v1/scenarios/instruction/{scenario_id}
```

Current behavior:

```text
Backend reads SCENARIO_PRESETS_PATH.
If SCENARIO_PRESETS_PATH does not exist, backend seeds it from SCENARIO_PRESETS_DEFAULT_PATH.
Backend does not overwrite the local scenario file once it exists.
Desktop Scenarios UI loads backend scenarios from GET /v1/scenarios.
Desktop Scenarios UI renders compact clickable backend scenario cards.
Hovering over a scenario card shows a human-readable details popup built from scenario metadata.
The hover popup is informational only and does not select or modify the scenario.
Selecting a scenario card or dropdown item loads the selected scenario instruction into the existing instruction editor.
If a scenario has userInstruction, Desktop loads userInstruction as Current Instructions.
Scenario Default Instructions remains the original scenario instruction from the scenario template.
Desktop calls POST /v1/scenarios/active to persist activeScenarioId in the local scenario runtime state.
Desktop Save stores edited Current Instructions as scenario.userInstruction in the local scenario runtime state by calling POST /v1/scenarios/instruction.
Desktop Reset to scenario default deletes scenario.userInstruction by calling DELETE /v1/scenarios/instruction/{scenario_id} and restores Current Instructions to the original scenario instruction.
Voice page displays the selected scenario name and behavior description.
Refresh Instructions continues to send the current backend instruction state to the active Realtime session.
```

Per-scenario instruction override fields in scenario_presets.local.json:

```text
instruction
= original/default scenario prompt
= preserved built-in scenario behavior
= used for Scenario Default Instructions

userInstruction
= optional user-edited prompt override for that scenario
= used as Current Instructions when present
= stored only in the local runtime scenario file

userInstructionUpdatedAt
= timestamp for the userInstruction override
```

Implemented default scenarios include:

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

Current Desktop UI direction:

```text
Instructions tab is renamed to Scenarios.
Page title is Scenario & Instructions.
Existing instruction editor remains the editing surface.
Scenario cards are populated from backend scenarios when available.
Scenario cards are compact and display only the scenario name plus Selected / Click to select state.
Hovering over or focusing a scenario card updates the Scenario Preview slot inside the Scenario Library panel.
Scenario Preview shows name, category, displayDetails when available, and recommendedUse.
If displayDetails is missing, Scenario Preview falls back to shortDescription.
Scenario Preview does not show the technical/model-facing instruction prompt.
Scenario Preview is informational only; clicking the card remains the only selection action.
Scenario preset dropdown is populated from backend scenarios when available.
Legacy hardcoded presets are hidden when backend scenarios exist and remain only as fallback when backend scenarios are unavailable.
Voice page shows Selected Scenario and Scenario behavior.
Future scenario metadata should add displayDetails for richer human-readable popup text while keeping instruction as the model-facing prompt.
```

Final packaged app direction:

```text
<install>\backend\scenario_presets.json = read-only default templates
<AppData>\CHATT-DIRECT\scenario_presets.local.json = user-editable runtime scenario file
<AppData>\CHATT-DIRECT\instructions.json = user-editable active instructions file
<AppData>\CHATT-DIRECT\provider_config.local.json = user provider configuration
<AppData>\CHATT-DIRECT\logs\ = runtime logs
```

Do not:

```text
write to install default scenario file at runtime
overwrite user local scenario file during app update
mix scenario runtime state with provider config
change audio flow because of scenarios
change provider runtime because of scenarios
change Realtime session behavior because of scenarios
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
Scenario card hover details use human-readable metadata, not the model-facing instruction prompt.
Future scenario_presets.json may add displayDetails to separate product-facing explanation from model-facing instructions.
```

---
17. Modern Desktop UI Baseline

Modern Desktop UI modernization is complete across the three active pages.

Completed UI modernization commits:

```text
Modernize desktop voice UI
Modernize desktop settings UI
Modernize desktop scenarios UI
```

Current Desktop window sizing:

```text
default width: 1120
default height: 820
minimum width: 860
minimum height: 720
```

Current deterministic UI zoom baseline:

```text
APP_UI_ZOOM_FACTOR = 0.7
Applied in Desktop/electron/main.cjs to mainWindow.webContents.
Applied immediately after BrowserWindow creation.
Re-applied on webContents did-finish-load.
This app-level zoom is intentional and deterministic.
It replaces accidental dependence on Chromium profile persisted zoom state.
```

Root cause finding for desktop scale issue:

```text
The installed app was not incorrectly zoomed.
The old development profile under Desktop/.electron-userdata contained a persisted Chromium per-host zoom entry around -2.0.
That persisted dev-profile zoom made npm start appear visually correct and masked the true default UI scale.
After resetting/renaming Desktop/.electron-userdata, development mode matched the installed app and appeared larger.
The accepted fix is deterministic Electron app zoom, not CSS rewrite and not user-profile persisted zoom.
```

Current desktop scale implementation rules:

```text
Do not use Chromium persisted profile zoom state as a product behavior.
Do not rely on Ctrl-minus/manual zoom or Preferences per_host_zoom_levels.
Do not solve desktop scale by broad CSS rewrite unless explicitly approved.
Keep BrowserWindow default at 1120 x 820 and minimum at 860 x 720.
Keep APP_UI_ZOOM_FACTOR centralized in Desktop/electron/main.cjs.
If visual scale needs future tuning, change only APP_UI_ZOOM_FACTOR first and validate before touching CSS.
```

Current visual design direction:

```text
dark navy / black glassmorphism
subtle 3D depth
layered gradients
soft blue and green glow accents
rounded glass cards
premium Windows desktop application look
professional AI control-console feeling
responsive dashboard layout
```

Current Voice page layout:

```text
modern Voice Session dashboard
Session and Activity are the main user-facing status indicators
AI contact visual with mic/core ring and waveform-style decoration
right-side Realtime Status and Activity cards
selected scenario visibility
bottom app status bar
```

Current Settings page layout:

```text
modern Settings control center
Connection card
Audio Output card
Session Cost Guard card
Provider Configuration card as the primary setup area
Diagnostics card
Auth and Log cards retained where present
```

Current Scenarios page layout:

```text
Scenario & Instructions page
Selected Scenario card
Scenario Library with compact scenario cards
Scenario Preview slot inside the Scenario Library panel
Current Instructions as the primary editor surface
Scenario Default Instructions as read-only/template-style preview
Instruction State and redundant Scenario Details are hidden/removed from visible workflow
```

Scenario Preview behavior:

```text
Hovering or focusing a scenario card updates the Scenario Preview slot.
Mouse leave or blur returns the preview to the selected scenario or neutral state.
Preview content uses scenario.name, scenario.category, scenario.displayDetails, and scenario.recommendedUse.
If displayDetails is missing, preview falls back to scenario.shortDescription.
The preview never shows scenario.instruction because that is the model-facing prompt.
Scenario card click remains the only scenario selection action.
```

UI implementation boundaries:

```text
These UI modernization phases did not change Direct Realtime audio capture/playback.
They did not change getLoopbackStream.
They did not change AudioWorklet registration or processor behavior.
They did not change WebSocket audio send/receive logic.
They did not change provider adapter behavior.
They did not change scenario API behavior.
They did not change Cost Guard runtime logic.
```


---
18. Mini Control Window and 0.1.8 Release Baseline

Mini Control Window is now part of the Desktop UI baseline.

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

Current Electron integration:

```text
Desktop/electron/main.cjs owns miniControlWindow lifecycle.
Desktop/electron/preload.cjs exposes electronAPI.miniControl.
Desktop/renderer/renderer.js remains the only owner of Direct Realtime runtime controls.
```

Current mini control behavior:

```text
When the main app is minimized, Electron opens a small floating Mini Control Window.
The Mini Control Window is always-on-top, frameless, transparent/dark glass, not shown in the taskbar, and movable by dragging the header area.
The Mini Control Window uses a narrow vertical layout.
The Mini Control Window shows Session and Activity status.
The Mini Control Window provides Start, Stop, Refresh, Repeat, Reset, and Open controls.
Open restores the main app and closes the Mini Control Window.
Closing the Mini Control Window does not stop the main app or backend.
```

Current command routing:

```text
Mini Control Window sends IPC commands to Electron main.
Electron main forwards supported mini-control commands to the existing main renderer.
The main renderer maps commands to existing buttons:
start   -> btnStart
stop    -> btnStop
refresh -> btnInstrRefresh
repeat  -> btnRepeatLastAnswer
reset   -> btnResetSession
```

Runtime ownership rule:

```text
Mini Control Window is a remote UI layer only.
It must not create a second WebSocket.
It must not create a second audio context.
It must not directly call backend Realtime APIs.
It must not own Direct Realtime state.
It must not duplicate provider/scenario/instruction runtime logic.
```

Status synchronization:

```text
The main renderer publishes Session and Activity state to the Mini Control Window through IPC.
Mini Control Window status follows the existing visible Session and Activity state.
Start/Stop/Refresh/Repeat/Reset disabled state follows the existing main renderer button state.
```

Release validation:

```text
node --check Desktop/electron/main.cjs: OK
node --check Desktop/electron/preload.cjs: OK
node --check Desktop/renderer/renderer.js: OK
node --check Desktop/renderer/mini-control.js: OK
Desktop runtime test: OK
Mini Control Window opens on minimize: OK
Mini Control Window vertical layout fits: OK
Mini Control Window can be moved: OK
Open restores full app: OK
Start/Stop/Refresh/Repeat/Reset work from Mini Control Window: OK
Session and Activity sync: OK
Desktop version 0.1.8: OK
Desktop package.json / package-lock.json UTF-8 without BOM: OK
Electron build 0.1.8: OK
Installer generated: dist\AnswerDesk AI Setup 0.1.8.exe
Installer upgrade over previous installed version: OK
Old local backup folders cleaned: OK
Old installer artifacts 0.1.5, 0.1.6, and 0.1.7 removed from dist: OK
Git clean after validation: OK
```

Design boundary:

```text
Do not change Direct Realtime audio capture/playback because of Mini Control Window.
Do not change backend app_realtime.py because of Mini Control Window.
Do not change provider adapters because of Mini Control Window.
Do not change scenario APIs because of Mini Control Window.
Do not remove main renderer ownership of Start/Stop/Refresh/Repeat/Reset.
```

---
19. Phase 2 AppData / userData Runtime Plan

Phase 2 objective:

```text
Prepare CHATT-DIRECT for packaged Windows app behavior where installed application files are read-only and all user/runtime files are stored under the user profile.
```

Canonical storage rule:

```text
Install folder = static application code and read-only templates
AppData/userData = writable user/runtime state
```

Final packaged runtime user folder:

```text
<AppData>\CHATT-DIRECT\
```

Final user/runtime files:

```text
<AppData>\CHATT-DIRECT\provider_config.local.json
<AppData>\CHATT-DIRECT\instructions.json
<AppData>\CHATT-DIRECT\scenario_presets.local.json
<AppData>\CHATT-DIRECT\logs\
```

Static install/backend files:

```text
<install>\backend\provider_capabilities.json
<install>\backend\provider_config.local.example.json
<install>\backend\scenario_presets.json
<install>\backend\app_realtime.py
<install>\backend\providers\
```

Required backend path variables for packaged runtime:

```env
PROVIDER_CONFIG_PATH=<AppData>\CHATT-DIRECT\provider_config.local.json
INSTRUCTIONS_PATH=<AppData>\CHATT-DIRECT\instructions.json
SCENARIO_PRESETS_PATH=<AppData>\CHATT-DIRECT\scenario_presets.local.json
PROVIDER_CAPABILITIES_PATH=<install>\backend\provider_capabilities.json
PROVIDER_CONFIG_EXAMPLE_PATH=<install>\backend\provider_config.local.example.json
SCENARIO_PRESETS_DEFAULT_PATH=<install>\backend\scenario_presets.json
PORT=50505
```

Phase 2 implementation direction:

```text
Electron main process owns app.getPath("userData").
Electron main process creates the CHATT-DIRECT user data folder.
Electron main process seeds or migrates required user/runtime files when missing.
Electron main process starts the backend child process with explicit env path variables.
Renderer continues to use localhost endpoints.
Backend continues to own provider, instruction, scenario, and Realtime APIs.
```

First-run behavior:

```text
If provider_config.local.json does not exist in AppData:
  seed from provider_config.local.example.json or allow backend fallback to template.

If instructions.json does not exist in AppData:
  seed from current instruction default logic or migrate existing Electron local instruction store.

If scenario_presets.local.json does not exist in AppData:
  seed from install/backend/scenario_presets.json.

Do not overwrite existing AppData files on application update.
```

Important risk to resolve in Phase 2:

```text
The current local/dev app can have two instruction stores:
- Electron local instruction store
- backend instructions.json

Phase 2 must unify final packaged runtime around:
<AppData>\CHATT-DIRECT\instructions.json
```

Phase 2 must not change:

```text
loopback/system/browser audio capture
microphone prohibition
provider adapter behavior
Realtime WebSocket path
selected output/headphones playback
instruction refresh WebSocket message shape
scenario behavior model
outgoing language rule behavior
incoming language plan
```

Phase 2 validation requirements:

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

Runtime validation:

```text
Desktop starts backend or reports a clear backend startup failure.
GET /v1/provider/config works through localhost.
GET /v1/instructions works through localhost.
GET /v1/scenarios works through localhost.
POST /v1/scenarios/instruction persists userInstruction to AppData scenario runtime state.
DELETE /v1/scenarios/instruction/{scenario_id} removes userInstruction from AppData scenario runtime state.
Provider save persists to AppData.
Instruction save persists to AppData.
Scenario local file is created in AppData if missing.
Start Direct Realtime still works with loopback/system audio only.
```

---
20. Session Cost Guard Baseline

Session Cost Guard is now part of the Direct Realtime runtime cost-protection layer.

Current implemented behavior:

```text
Settings -> Connection + Audio Settings includes:
- Auto-stop if idle: Off / 5 / 10 / 15 minutes
- Warn before auto-stop: checkbox
- Hard max session duration: Off / 15 / 30 / 60 minutes
```

Persistence:

```text
Cost Guard settings are stored in renderer localStorage:
chatt.costGuard.idleMinutes
chatt.costGuard.warnBeforeStop
chatt.costGuard.maxSessionMinutes
```

Runtime behavior:

```text
directSessionStartedAt records successful Start Direct Realtime time.
directLastSpeechStartedAt records the latest provider/server VAD input_audio_buffer.speech_started event.
A lightweight renderer setInterval checks limits every 5 seconds.
Warning messages are written to the Desktop log through push(...).
Idle auto-stop triggers when now - directLastSpeechStartedAt >= selected idle limit.
Hard max auto-stop triggers when now - directSessionStartedAt >= selected max duration.
Both stop paths call the existing stopDirectRealtime({ closeRealtime: true }) flow.
```

Confirmed behavior:

```text
Idle warning appears approximately 30 seconds before the idle limit.
Idle limit reached logs a clear message and stops Direct Realtime.
Local audio playback stops immediately.
Realtime WebSocket closes cleanly with direct-realtime-stop.
New speech_started activity resets the idle timer.
Hard max session duration does not reset on speech activity.
```

Design boundaries:

```text
Do not use audio frame/chunk activity as the idle signal.
Do not add microphone input.
Do not change AudioWorklet, sample rate, PCM format, WebSocket audio append, provider adapter payloads, or backend app_realtime.py for Cost Guard.
Cost Guard belongs to Connection + Audio Settings, not Provider Configuration.
```

Next candidate improvements:

```text
Cost Guard UX: countdown/status in UI, remaining time display, toast/modal warning instead of log-only warning.
Stability and cost: auto-stop or protection when app is minimized/inactive, pause/resume behavior, reconnect policy review.
```

---
21. Commercial Direction
Preferred commercial packaging model:
```text
Windows app sold as a packaged desktop application
Customer brings their own provider/API key
```
Current licensing/trial implementation status:
```text
Dedicated License page is implemented in Desktop.
Electron main calls the hosted Azure Licensing API.
Azure Function App answerdesk-licensing-api-dev is deployed in Resource Group AI / East US 2.
Azure Table Storage LicenseRecords stores 3-day trial records.
Desktop License page end-to-end test shows Trial Active from Azure storage-backed API.
Start Direct Realtime is intentionally not license-gated during current development/packaging validation.
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
22. Work Process Rules
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
``````


---

23. Simplified Voice Status Indicators Baseline

Commit:

```text
d94ee70 Simplify voice status indicators
```

Current Voice page status model:

```text
The Voice page now uses two user-facing status indicators:
- Session
- Activity
```

User-facing Session states:

```text
Session: OFF
Session: STARTING
Session: ON
Session: RECONNECTING
```

User-facing Activity states:

```text
Activity: Idle
Activity: Listening
Activity: Speaking
```

Implementation rule:

```text
The old technical indicators remain in the DOM as hidden compatibility/diagnostic elements.
They must continue to be updated by the renderer logic.
```

Hidden technical indicators preserved:

```text
sttStatus     = DIRECT technical status
rtStatus      = REALTIME websocket technical status
listenStatus  = low-level listening/speech-detected activity
speakStatus   = low-level assistant speaking activity
```

Current UX behavior:

```text
Normal users see Session and Activity only.
DIRECT, REALTIME, LISTENING, and SPEAKING are hidden from the normal Voice page UI.
The hidden technical indicators remain available for troubleshooting/debug compatibility.
```

Session state behavior:

```text
Direct Realtime starting shows Session: STARTING.
Direct Realtime active / Realtime connected shows Session: ON.
Realtime websocket reconnecting shows Session: RECONNECTING.
Stopped or inactive Direct Realtime shows Session: OFF.
```

Activity state behavior:

```text
No current input/output activity shows Activity: Idle.
Detected incoming speech shows Activity: Listening.
Assistant audio playback shows Activity: Speaking.
Speaking has priority over Listening when both internal signals overlap.
```

Validation:

```text
node --check Desktop/renderer/renderer.js: OK
Runtime test: OK
Voice page displays Session and Activity correctly.
Start Direct Realtime: Session STARTING -> ON.
Incoming speech: Activity Listening.
Assistant response playback: Activity Speaking.
Stop Direct Realtime: Session OFF and Activity Idle.
Git clean after commit.
```

Design boundary:

```text
Do not remove hidden technical status elements without a separate diagnostics design.
Do not change audio capture/playback, Realtime websocket flow, provider logic, scenario logic, or Cost Guard logic for this UI simplification.

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

---

## 26. Azure Licensing / Trial Implementation Baseline

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
```

Current Azure Function runtime:

```text
Azure Functions v4
Node.js 24 on Azure Function App
Local package engine currently allows node >=20
@azure/functions
@azure/data-tables
```

Current Azure app settings used by licensing API:

```text
LICENSE_STORAGE_CONNECTION_STRING
LICENSE_TABLE_NAME=LicenseRecords
```

Security note:

```text
Do not paste or commit LICENSE_STORAGE_CONNECTION_STRING, storage account keys, API keys, tokens, webhook secrets, or payment provider secrets.
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
Azure Table Storage is the current MVP persistence layer for trial records.
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

Current license cache schema:

```json
{
  "schemaVersion": 1,
  "installId": "uuid",
  "deviceHash": null,
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
error
```

Current trial behavior:

```text
Trial duration: 3 days.
Trial email: required for Start 3-day Trial.
trial/start creates a new trial record for a new installId.
trial/start does not reset or extend trialStartedAt/trialExpiresAt for an existing installId.
trial/start may update registeredEmail for an existing installId.
validate reads the record and returns trial_active while now < trialExpiresAt.
validate returns trial_expired when now >= trialExpiresAt.
```

Current activate behavior:

```text
Payment-backed license activation is not connected yet.
activate validates email, licenseKey, and installId.
activate never stores or returns the raw licenseKey.
activate stores/returns licenseKeyLast4 only.
activate preserves existing trial status if a trial record exists.
activate does not mark a record licensed yet.
```

Current access/enforcement rule:

```text
Start Direct Realtime is intentionally not license-gated during current development and packaging validation.
The License page, hosted licensing API, local cache, and Azure Table Storage flow are active.
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
```

Current endpoint validation results:

```text
GET /v1/license/health:
  OK, returns ok:true, status:healthy.

POST /v1/license/trial/start:
  OK, creates trial_active record with trialStartedAt and trialExpiresAt.

POST /v1/license/validate:
  OK, reads trial record and returns trial_active while active.

POST /v1/license/trial/start for same installId:
  OK, does not extend trialStartedAt/trialExpiresAt.

POST /v1/license/activate:
  OK for skeleton behavior, returns ok:false with Payment-backed license activation is not connected yet, preserves trial status, returns only licenseKeyLast4.
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
Implement rate limiting / abuse protection for trial start.
Implement storage key rotation and secret scan before production/public release.
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