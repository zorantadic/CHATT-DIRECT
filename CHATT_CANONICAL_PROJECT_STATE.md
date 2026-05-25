CHATT Canonical Project State
Last updated: 2026-05-23
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
multilingual UI display support
header language selector synchronized with Settings language selector
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
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/styles.css
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

Active provider configuration in the older/manual backend startup path is saved locally in:
```text
backend/provider_config.local.json
```

Electron-started local/dev runtime now uses the Electron userData runtime file:
```text
Desktop/.electron-userdata/provider_config.local.json
```

Important AppData/userData migration lesson from 2026-05-23:
```text
If Desktop/.electron-userdata/provider_config.local.json is missing and is seeded from provider_config.local.example.json, it may contain placeholder values such as:
https://your-resource-name.cognitiveservices.azure.com
apiKey: ""

That placeholder provider config causes Direct Realtime startup to fail after local /voice/ws connects, with:
[Errno 11001] getaddrinfo failed

This is not an audio, WebSocket, or Realtime engine failure. It means the active provider endpoint cannot be resolved.
After AppData/userData migration, provider settings must be re-entered through Settings -> Provider Configuration or migrated from backend/provider_config.local.json before Direct Realtime validation.
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
Scenario Preview slot uses displayDetails fallback to shortDescription and does not show scenario.instruction: OK
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
Voice page uses Session and Activity as primary user-facing status indicators
Settings page is organized as a dark glass control center with Connection, Audio Output, Provider Configuration, Session Cost Guard, Diagnostics, Auth, and Log cards
Scenarios page is organized as Scenario & Instructions with Selected Scenario, Scenario Library, Scenario Preview, Current Instructions, and Scenario Default Instructions cards
Scenario Preview displays human-readable metadata using displayDetails when available and never displays scenario.instruction
Bottom app status bar no longer shows the redundant bottom volume mirror
Header Backend/Provider cards removed and replaced with compact Select Language control
Settings Display Language and Header Select Language controls remain synchronized through shared display-language state

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
18. Phase 2 AppData / userData Runtime Plan

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
19. Session Cost Guard Baseline

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
20. Commercial Direction
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
21. Work Process Rules
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

22. Simplified Voice Status Indicators Baseline

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
23. Update Workflow / AppData Runtime Notes

Completed update foundation commits:
```text
Add updater dependency and publish config
Add update IPC foundation
```

Current update workflow status:
```text
electron-updater dependency is installed.
Desktop/package.json includes generic publish provider: https://updates.chattdirect.com/win/
Electron main/preload update IPC foundation exists.
No Settings Update UI has been implemented yet.
No automatic startup update check is enabled.
autoDownload = false.
autoInstallOnAppQuit = false.
Restart/install flow must stop only Electron-owned backend child process before quitAndInstall.
```

AppData/userData runtime warning:
```text
Local/dev Electron runtime can use Desktop/.electron-userdata/provider_config.local.json instead of backend/provider_config.local.json.
If this runtime file is seeded from provider_config.local.example.json, it contains placeholder endpoint/key values.
Provider config must be re-entered or migrated before Direct Realtime testing.
A placeholder endpoint causes [Errno 11001] getaddrinfo failed when backend tries to connect to the upstream Realtime provider.
```

---

24. Audio Output Safety Confirmation Baseline

Commit:

```text
6413683 Add audio output safety confirmation
```

Audio Output Safety is now part of the Desktop runtime baseline.

Goal:

```text
Prevent Realtime model voice output from accidentally playing through laptop speakers.
Direct Realtime may start only when the selected output sink is safe.
```

Final safety rule:

```text
A sink is safe if:
1. it is currently detected as a headphones-labeled audio output device, or
2. it matches a user-confirmed audio output device saved in the current Electron user profile/localStorage.

If the safe sink disappears, changes, or fails validation after devicechange, Direct Realtime must stop or remain blocked until a safe output is available again.
```

Current implementation files:

```text
Desktop/renderer/index.html
Desktop/renderer/renderer.js
Desktop/renderer/styles.css
```

New Settings -> Audio Output UI:

```text
Audio Safety
Status: Not confirmed / Headphones detected / Confirmed
Test Selected Output
Confirm This Output Uses Headphones
Reset Confirmation
```

Current persistence keys:

```text
chatt.audioSafety.record
chatt.rtOutputDeviceId
chatt.rtOutputDeviceLabel
chatt.rtPreferredDeviceLabel
```

Current audio safety record shape:

```json
{
  "confirmed": true,
  "source": "user-confirmed",
  "deviceId": "<selected audiooutput deviceId>",
  "label": "<selected audiooutput label>",
  "fingerprint": "<deviceId>|<label>",
  "confirmedAt": "<ISO timestamp>"
}
```

Current safe output resolution priority:

```text
1. Explicit selected dropdown device if it is headphones-labeled.
2. Explicit selected dropdown device if it matches a saved user-confirmed safety record.
3. Saved confirmed device if present and still valid.
4. Saved Realtime output device if it is headphones-labeled.
5. Preferred label match if it is headphones-labeled.
6. First headphones-labeled output.
7. Otherwise unsafe.
```

First-run behavior:

```text
If a headphones-labeled output device exists:
  app auto-selects it and Realtime may start.
  manual device registration is not required.

If no headphones-labeled output device exists and no confirmed record exists:
  Realtime is blocked.
  user must select an output device, test it, and confirm it plays only in headphones.

If a saved confirmed output device exists and still matches:
  app auto-selects it and Realtime may start.
```

User-confirmed device registration flow:

```text
User selects an output device.
User clicks Test Selected Output.
The app plays a short beep through the same rtOutEl / setSinkId / playback pipeline used by Realtime output.
User confirms only if the test sound is heard only in headphones.
The app saves chatt.audioSafety.record and selected output preference.
Confirm is blocked unless the selected output was tested first and the selected output fingerprint still matches the tested fingerprint.
```

Devicechange behavior:

```text
The app continues to use navigator.mediaDevices.ondevicechange as the runtime output-change signal.
On devicechange, the app refreshes audio outputs and verifies safe output state.
If the safe output is no longer valid while Direct Realtime is active or starting:
  local playback stops immediately.
  Direct Realtime stops.
  Realtime WebSocket closes cleanly.
  Start remains blocked until a safe output exists again.
If headphones are plugged back in and a safe output is detected again:
  Realtime can start again.
```

Confirmed validation:

```text
node --check Desktop/renderer/renderer.js: OK
Desktop runtime test: OK
Headphones-labeled output auto-detected and selected: OK
Test Selected Output beep heard in headphones: OK
Confirm This Output Uses Headphones flow: OK
chatt.audioSafety.record persisted in Electron dev profile: OK
Selected output device persisted in Electron profile: OK
Direct Realtime start with safe headphones output: OK
Realtime output sink set to Communications - Headphones (Surface High Definition Audio): OK
Unplug headphones during active Realtime: devicechange detected and Direct Realtime stopped: OK
Realtime WebSocket closed cleanly with direct-realtime-stop: OK
Plug headphones back in: safe output detected and Direct Realtime can start again: OK
Git clean after commit: OK
```

Runtime boundary:

```text
This change is Desktop renderer safety/routing only.
It does not change backend/app_realtime.py.
It does not change provider adapters.
It does not change Realtime WebSocket protocol.
It does not change loopback/system/browser audio capture.
It does not change AudioWorklet behavior.
It does not change Mini Control Window ownership.
```

Implementation boundary:

```text
Do not blindly allow generic Speakers.
A generic Speakers output can be used only if it matches a saved user-confirmed safety record.
Do not require users to rename Windows audio devices.
Do not replace existing headphones auto-detection.
Do not introduce microphone input.
```

Known UX note:

```text
On machines where the selected output label already contains Headphones, the status may show Headphones detected even when a user-confirmed record also exists.
This is acceptable because auto-detected headphones is already a safe path.
On machines where Windows exposes a valid headphones-routed output under an ambiguous label such as Speakers, the saved user-confirmed path should show Confirmed after test/confirmation and restart.
```
