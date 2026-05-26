# CHATT Web Canonical State

Last updated: 2026-05-25

This file is the detailed canonical state for the **parallel Web UI/runtime track** of the `CHATT-DIRECT` repository.

Use this file before changing:

```text
apps/web-ui
Web UI structure
Web runtime configuration
Web read-only backend integration
Web Desktop-parity layout
future browser audio/WebSocket phases
```

Required companion canonical files:

```text
CHATT_WEB_CANONICAL_PROJECT_STATE.md
CHATT_CANONICAL_PROJECT_STATE.md
CHATT_DIRECT_CANONICAL_STATE.md
```

The Web canonical state must remain aligned with the Desktop and Direct canonical files.

---

## 1. Web Runtime Identity

`apps/web-ui` is the browser Web counterpart of the CHATT Direct Windows/Electron app.

Current Web runtime state:

```text
Vite + React
Desktop-parity UI shell
read-only backend data integration
no Web audio runtime
no Realtime WebSocket runtime
no microphone input
no provider/scenario/instruction writes
```

Current Web app purpose:

```text
Provide a browser UI counterpart to the Desktop application.
Reuse the existing backend.
Mirror the Desktop visual/UX structure.
Prepare a safe foundation for later browser runtime work.
```

Current Web app is not:

```text
a separate product
a redesign
a new backend
a runtime replacement for Desktop
a restored legacy frontend
a STT/Orchestrator/TTS/manual frontend
```

---

## 2. Current Web Runtime Flow

Current Web runtime/data flow:

```text
Browser
-> apps/web-ui React app
-> runtimeConfig.realtimeHttp
-> existing backend/app_realtime.py HTTP endpoints on port 50505
-> provider/scenario data returned as JSON
-> Web UI renders read-only Desktop-like presentation
```

Current Web does not use:

```text
/voice/ws
browser audio capture
AudioWorklet
AudioContext playback
getDisplayMedia
getUserMedia
provider Realtime WebSocket
browser output device routing
```

The configured Realtime WebSocket endpoint is displayed only as read-only configuration:

```text
ws://127.0.0.1:50505/voice/ws
```

---

## 3. Local Paths

Project root:

```text
C:\Projects\chatt-direct
```

Web app:

```text
C:\Projects\chatt-direct\apps\web-ui
```

Shared backend:

```text
C:\Projects\chatt-direct\backend
```

Desktop source-of-truth UI:

```text
C:\Projects\chatt-direct\Desktop\renderer
```

---

## 4. Web Startup

Backend startup:

```powershell
cd C:\Projects\chatt-direct\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

Web development startup:

```powershell
cd C:\Projects\chatt-direct\apps\web-ui
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Build:

```powershell
cd C:\Projects\chatt-direct\apps\web-ui
npm.cmd run build
```

---

## 5. Web Configuration

Configuration file:

```text
apps/web-ui/src/config/runtimeConfig.js
```

Current runtime config behavior:

```text
Uses Vite environment variables.
Falls back to local backend endpoints.
Does not contain secrets.
Does not call providers directly.
```

Environment variables:

```text
VITE_REALTIME_HTTP
VITE_REALTIME_WS
```

Current `.env.example`:

```env
VITE_REALTIME_HTTP=http://127.0.0.1:50505
VITE_REALTIME_WS=ws://127.0.0.1:50505/voice/ws
```

Default config values:

```text
realtimeHttp = http://127.0.0.1:50505
realtimeWs   = ws://127.0.0.1:50505/voice/ws
```

Rule:

```text
Do not hardcode provider secrets or API keys in Web UI.
Do not call OpenAI/Azure OpenAI provider APIs from browser code.
```

---

## 6. Web API Clients

Current API client files:

```text
apps/web-ui/src/api/providerClient.js
apps/web-ui/src/api/scenarioClient.js
```

Current provider API client:

```text
getProviderConfig()
  -> GET /v1/provider/config

getProviderCapabilities()
  -> GET /v1/provider/capabilities
```

Current scenario API client:

```text
getScenarios()
  -> GET /v1/scenarios
```

Current backend response shapes observed:

```text
GET /v1/provider/config
  -> { version, activeProvider, providers }

GET /v1/provider/capabilities
  -> { version, defaultProvider, providers }

GET /v1/scenarios
  -> { version, defaultScenarioId, activeScenarioId, scenarios, source, defaultSource }
```

Current API behavior:

```text
read-only only
fetches from runtimeConfig.realtimeHttp
throws error for non-OK HTTP status
does not write provider config
does not test provider connection
does not update scenarios
does not update instructions
```

Future API changes must inspect backend/app_realtime.py first.

---

## 7. Web App Structure

Current root component:

```text
apps/web-ui/src/App.jsx
```

Current App responsibilities:

```text
active tab/page state
backend data loading
provider config/capabilities loading
scenario data loading
provider state normalization
scenario state normalization
connection state assembly
Shell/page composition
BottomStatusBar composition
```

Current App should not grow indefinitely.

Future refactor candidate:

```text
apps/web-ui/src/state/providerState.js
apps/web-ui/src/state/scenarioState.js
apps/web-ui/src/state/backendData.js
```

Current components:

```text
apps/web-ui/src/components/BottomStatusBar.jsx
apps/web-ui/src/components/DataNotice.jsx
apps/web-ui/src/components/GlassPanel.jsx
apps/web-ui/src/components/ReadonlyField.jsx
apps/web-ui/src/components/Shell.jsx
apps/web-ui/src/components/StatusPill.jsx
```

Current pages:

```text
apps/web-ui/src/pages/VoicePage.jsx
apps/web-ui/src/pages/SettingsPage.jsx
apps/web-ui/src/pages/ScenariosPage.jsx
```

Current styling:

```text
apps/web-ui/src/styles/app.css
```

---

## 8. Web Shell Baseline

Shell component:

```text
apps/web-ui/src/components/Shell.jsx
```

Current shell structure:

```text
appShell
appHeader
brandBlock
brandTitle = AnswerDesk AI
brandSubtitle = Realtime Voice
header language selector placeholder/read-only
nav tabs: Voice, Settings, Scenarios
main content area
```

Language selector status:

```text
Visible as Desktop parity placeholder.
Disabled/read-only.
Does not change UI language yet.
Does not change model instructions.
Does not change backend state.
```

Do not wire language selector behavior without a separate Web localization phase.

---

## 9. Bottom Status Bar Baseline

Bottom status component:

```text
apps/web-ui/src/components/BottomStatusBar.jsx
```

Current bottom bar fields:

```text
Backend
WS
Audio Input
Output
```

Current values:

```text
Backend:
Configured or Connected using connectionState.backendLabel

WS:
Not connected

Audio Input:
Not started

Output:
Browser default / Not selected
```

Rule:

```text
Do not show WS as connected until browser Realtime WebSocket runtime exists.
Do not show audio input/output as active until Web audio runtime exists.
```

---

## 10. Voice Page Baseline

Voice page component:

```text
apps/web-ui/src/pages/VoicePage.jsx
```

Current Voice page structure:

```text
voiceDashboard
voiceMainCard
scenarioSummary
statusPillRow
DataNotice
costGuardNotice
aiVisual
voiceControls
quickControls
voiceSide
Realtime Status side card
Activity side card
```

Current Voice status:

```text
Session: OFF
Activity: Idle
```

Current disabled controls:

```text
Start Direct Realtime
Stop
Refresh Instructions
Repeat Last Answer
Reset Session
Realtime rate
Realtime volume
Output device
Refresh output device
```

Current Voice page data sources:

```text
scenarioState.selected
providerState
connectionState
```

Current Voice page rule:

```text
All runtime controls are disabled/read-only in current Web baseline.
Do not implement audio or WebSocket in VoicePage without a separate accepted runtime phase.
```

---

## 11. Settings Page Baseline

Settings page component:

```text
apps/web-ui/src/pages/SettingsPage.jsx
```

Current Settings page structure:

```text
settingsDashboard
Connection card
Audio Output card
Audio Safety section
Session Cost Guard card
Provider Configuration card
Application Update card
Diagnostics card
Log panel placeholder
```

Current Provider Configuration data:

```text
Active Provider
Region
Endpoint
API Version
Deployment / Model label
Voice
Incoming Language
Outgoing Language
API Key = Stored outside the web UI
```

Current disabled controls:

```text
Use Local Backend
Save Settings
Reset Settings
Test Selected Output
Confirm This Output Uses Headphones
Reset Confirmation
Session Cost Guard controls
Test Connection
Save Provider
Reset Provider
Application Update controls
Log copy/clear/download
```

Rule:

```text
Do not implement provider save/test in Web until explicitly approved.
Do not store API keys in browser localStorage/sessionStorage.
Provider secrets remain backend-side only.
```

---

## 12. Scenarios Page Baseline

Scenarios page component:

```text
apps/web-ui/src/pages/ScenariosPage.jsx
```

Current Scenarios page structure:

```text
scenarioPage
scenarioPageHeader
scenarioHeaderBadges
Selected Scenario panel
Scenario Library panel
Scenario Preview area
Scenario Details panel
Current Instructions panel
Scenario Default Instructions panel
Instruction State panel
```

Current scenario data usage:

```text
scenarioState.scenarios
scenarioState.selected
scenarioState.activeScenarioId
scenarioState.defaultScenarioId
scenarioState.instructionText
scenarioState.defaultInstruction
scenarioState.instructionSource
scenarioState.instructionOverrideLabel
scenarioState.hasCustomInstruction
```

Current disabled controls:

```text
Save Instructions
Refresh Instructions
Reset to Scenario Default
```

Scenario instruction display rule:

```text
Scenario cards and preview use human-readable metadata:
name
category
shortDescription
displayDetails
recommendedUse

Instruction text may be shown only inside read-only instruction panels.
Do not show model-facing instruction text as a scenario card preview.
```

Write behavior:

```text
No scenario writes are implemented.
No active scenario change is persisted from Web.
No userInstruction save/delete is implemented from Web.
```

---

## 13. Web Visual System Baseline

Current CSS file:

```text
apps/web-ui/src/styles/app.css
```

Current visual system:

```text
dark navy/black base
radial lighting overlays
subtle grid overlay
glassPanel cards
compact dashboard density
Desktop-like header/nav
status pills
settings badges
scenario badges
blue/green/amber/red tone system
two-column dashboard layout
bottom status bar
responsive breakpoints
```

Important CSS selectors/classes include:

```text
appShell
appHeader
brandBlock
nav
glassPanel
voiceDashboard
voiceMainCard
voiceSide
statusPillRow
pill
dataNotice
costGuardNotice
aiVisual
voiceControls
quickControls
sideCard
statusTable
readonlyField
appBottomBar
settingsDashboard
settingsCard
settingsGrid
audioSafetyBox
costGuardCard
providerSettingsCard
diagnosticsLayout
settingsLogPanel
scenarioPage
scenarioLayout
scenarioPanel
scenarioCards
currentInstructionsPanel
defaultInstructionsPanel
instructionStatePanel
```

Responsive breakpoints:

```text
@media (max-width: 1080px)
@media (max-width: 860px)
```

Visual rule:

```text
Do not replace the Web UI with a generic dashboard or marketing-style layout.
Desktop UI parity is the accepted visual direction.
```

---

## 14. Current Web Validation Baseline

Confirmed:

```text
npm.cmd run build: OK
Vite production build: OK
Desktop syntax checks: OK
backend/ was not modified.
Desktop/ was not modified.
```

Validation commands:

```powershell
cd C:\Projects\chatt-direct

npm.cmd --prefix .\apps\web-ui run build

node --check .\Desktop\electron\main.cjs
node --check .\Desktop\electron\preload.cjs
node --check .\Desktop\renderer\renderer.js

git status --short --untracked-files=all
git diff --name-status
git diff --stat
```

Runtime visual validation:

```text
Web app opened at http://127.0.0.1:5173/
Backend running at http://127.0.0.1:50505
Web app loaded scenario/provider data from backend.
Scenarios page displayed active scenario and instructions.
Web UI visually matched Desktop-style layout after Phase 4.
```

---

## 15. Current Known Issues / Non-Blockers

Known non-blocking Web observations:

```text
Browser textarea scrollbars use default browser/Windows styling.
Some pages may have more vertical scroll than Desktop due to browser layout and read-only panels.
```

Not blockers for current baseline:

```text
Disabled controls are expected.
WS shows Not connected.
Audio Input shows Not started.
Output shows Browser default / Not selected.
Provider save/test is disabled.
Scenario save/edit/reset is disabled.
```

Potential future polish:

```text
textarea scrollbar styling
density/height tuning
Scenarios page scroll management
disabled-control copy refinement
log panel behavior
Desktop label parity audit
```

---

## 16. Critical Browser Audio Rule

Current Web app does not implement audio.

Future Web audio must obey:

```text
No microphone input.
Do not use navigator.mediaDevices.getUserMedia.
Browser input, if implemented, must use navigator.mediaDevices.getDisplayMedia with audio.
Stop/remove video tracks immediately.
Use only returned audio track.
```

Future browser capture path candidate:

```javascript
navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
```

Important limitation:

```text
Browser getDisplayMedia behavior is controlled by browser permissions and user selection UI.
Browser Web cannot fully replicate Electron/Windows loopback capture and output routing.
```

Any future Web audio phase must explicitly document browser limitations before implementation.

---

## 17. Future Web Realtime Rule

Current Web app does not connect to `/voice/ws`.

Future Web Realtime must use the existing backend WebSocket:

```text
ws://127.0.0.1:50505/voice/ws
```

Future Web Realtime must not:

```text
create a new backend
call provider Realtime directly from browser
send provider API keys to browser
reintroduce STT/Orchestrator/TTS/manual paths
bypass backend provider adapters
```

Future Web Realtime must preserve:

```text
existing backend/app_realtime.py
existing provider adapters
existing session.update ownership
existing scenario/instruction model
existing outgoing language steering model
```

---

## 18. Web Security and Secrets Rule

Current Web app has no secrets.

Rules:

```text
No provider API keys in browser code.
No provider API keys in .env files committed to Git.
No OpenAI/Azure OpenAI direct calls from browser.
No localStorage/sessionStorage storage of API keys unless explicitly approved by a separate security design.
```

Current provider key status:

```text
Provider/API credentials remain backend-side.
Web UI displays "Stored outside the web UI" for API Key.
```

---

## 19. Web Deployment Direction

Current Web app is local/dev only.

Possible future deployment direction:

```text
Frontend:
Azure Static Web Apps or Azure App Service static hosting

Backend:
Azure Container Apps running existing backend/app_realtime.py

Environment:
VITE_REALTIME_HTTP=https://<backend-host>
VITE_REALTIME_WS=wss://<backend-host>/voice/ws
```

Future deployment must resolve:

```text
CORS
WSS ingress
backend public endpoint
secrets/backend environment variables
provider key storage
browser audio limitations
authentication if needed
```

Do not add Azure deployment workflows without explicit approval.

---

## 20. Work Rules for Web Runtime Changes

Before editing Web files:

```text
Inspect the relevant current file content.
Inspect Desktop source-of-truth files when doing UI parity changes.
Inspect backend/app_realtime.py when doing API/runtime changes.
Do not generate blind replace scripts.
Use exact paths.
Keep changes small.
```

After Codex/Web changes:

```powershell
cd C:\Projects\chatt-direct
git status --short --untracked-files=all
git diff --name-status
git diff --stat
```

For untracked files:

```text
Do not rely on plain git diff.
Inspect new files directly before commit.
```

Before commit:

```powershell
cd C:\Projects\chatt-direct

npm.cmd --prefix .\apps\web-ui run build

node --check .\Desktop\electron\main.cjs
node --check .\Desktop\electron\preload.cjs
node --check .\Desktop\renderer\renderer.js

git status --short --untracked-files=all
git diff --name-status
git diff --stat
```

UI changes require visual validation in the browser before commit.

Runtime changes require runtime validation before commit.

---

## 21. Current Web Baseline Summary

Current accepted Web baseline:

```text
apps/web-ui is a Desktop-parity React/Vite browser app.
It uses the existing Direct Realtime backend on port 50505.
It displays provider and scenario data read-only.
It mirrors the Desktop app structure and visual language.
It does not implement Web audio or Realtime WebSocket runtime yet.
It does not introduce microphone input.
It does not change Desktop or backend.
It is ready for future Web-specific phases after canonical update.
```

Current last Web baseline commit:

```text
4a163e5 Align web UI with desktop layout
```
