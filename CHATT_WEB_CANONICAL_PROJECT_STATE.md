# CHATT Web Canonical Project State

Last updated: 2026-05-25

This file is the project-level canonical state for the **parallel Web version** of the `CHATT-DIRECT` repository.

Use this file before making project-wide decisions about the Web app architecture, repository layout, UI parity, backend reuse, deployment direction, or future Web runtime feature work.

This file is intentionally separate from the Desktop canonical files.

Required companion canonical files:

```text
CHATT_CANONICAL_PROJECT_STATE.md
CHATT_DIRECT_CANONICAL_STATE.md
CHATT_WEB_CANONICAL_STATE.md
```

Relationship to existing canonical files:

```text
CHATT_CANONICAL_PROJECT_STATE.md
= source of truth for overall CHATT-DIRECT project direction, Desktop baseline, backend baseline, workflow rules, packaging, and cleanup boundaries.

CHATT_DIRECT_CANONICAL_STATE.md
= source of truth for active Windows/Electron Direct Realtime runtime, Desktop audio capture/playback, provider adapter runtime, session behavior, scenario behavior, and backend Realtime flow.

CHATT_WEB_CANONICAL_PROJECT_STATE.md
= source of truth for the parallel Web application project direction.

CHATT_WEB_CANONICAL_STATE.md
= source of truth for detailed Web app implementation/runtime/UI state.
```

---

## 1. Web Project Identity

The Web app is a **parallel browser-based counterpart** to the existing CHATT Direct Windows/Electron app.

It is not a replacement for the Desktop app.

Current Web direction:

```text
React/Vite Web UI
parallel app under apps/web-ui
uses the existing backend/app_realtime.py backend on port 50505
Desktop UI parity as the visual/UX target
read-only backend integration baseline
no Web audio capture yet
no Realtime WebSocket runtime yet
no browser microphone input
no new backend
no legacy STT/Orchestrator/TTS/manual architecture
```

The Web app must be treated as:

```text
web counterpart of the existing Desktop app
same product identity
same page model
same visual language
same backend source
separate browser implementation
```

The Web app must not be treated as:

```text
a new unrelated dashboard
a marketing-style redesign
a replacement for Desktop
a new backend architecture
a return to the old frontend/Vite runtime
a reintroduction of STT/Orchestrator/TTS/manual paths
```

---

## 2. Current Web Baseline

Current committed Web milestones:

```text
e74ca40 Add initial web UI skeleton
4a56d1c Add web runtime config layer
58511dd Add read-only web backend integration
ef779b5 Fix web app React import
4a163e5 Align web UI with desktop layout
```

Current Web baseline status:

```text
apps/web-ui exists.
Vite React app builds successfully.
Web UI uses runtimeConfig.js for endpoint configuration.
Web UI reads existing backend data using read-only API clients.
Web UI visually aligns with the Desktop layout and design system.
Web UI displays Voice, Settings, and Scenarios pages.
Web UI has Desktop-like shell/header/nav/bottom status bar.
Web UI does not start audio capture.
Web UI does not open a Realtime WebSocket.
Web UI does not perform provider/scenario/instruction writes.
Web UI does not modify or require backend changes.
```

---

## 3. Repository Layout

Current project root:

```text
C:\Projects\chatt-direct
```

Existing stable Desktop app:

```text
C:\Projects\chatt-direct\Desktop
```

Existing shared backend:

```text
C:\Projects\chatt-direct\backend
```

Parallel Web app:

```text
C:\Projects\chatt-direct\apps\web-ui
```

Current Web files:

```text
apps/web-ui/.env.example
apps/web-ui/README_WEB.md
apps/web-ui/index.html
apps/web-ui/package.json
apps/web-ui/package-lock.json
apps/web-ui/src/main.jsx
apps/web-ui/src/App.jsx
apps/web-ui/src/config/runtimeConfig.js
apps/web-ui/src/api/providerClient.js
apps/web-ui/src/api/scenarioClient.js
apps/web-ui/src/components/BottomStatusBar.jsx
apps/web-ui/src/components/DataNotice.jsx
apps/web-ui/src/components/GlassPanel.jsx
apps/web-ui/src/components/ReadonlyField.jsx
apps/web-ui/src/components/Shell.jsx
apps/web-ui/src/components/StatusPill.jsx
apps/web-ui/src/pages/VoicePage.jsx
apps/web-ui/src/pages/SettingsPage.jsx
apps/web-ui/src/pages/ScenariosPage.jsx
apps/web-ui/src/styles/app.css
```

Generated/ignored Web files:

```text
apps/web-ui/node_modules/
apps/web-ui/dist/
apps/web-ui/.env
apps/web-ui/.env.local
apps/web-ui/.env.*.local
```

---

## 4. Git Ignore Rule for Web App

The root `.gitignore` must allow Web app files to be visible.

Current Web tracking rule:

```text
!apps/
!apps/web-ui/
!apps/web-ui/**
```

Generated/runtime files remain ignored through existing global rules:

```text
**/node_modules/
**/dist/
**/build/
**/.vite/
**/.cache/
.env
.env.*
**/.env
**/.env.*
```

Web-specific environment template is allowed:

```text
!apps/web-ui/.env.example
```

Important rule:

```text
Do not return to per-file whitelist rules for apps/web-ui.
New Web components/pages/config files must be visible in git status automatically.
```

---

## 5. Backend Reuse Rule

The Web app must use the existing backend.

Canonical backend:

```text
backend/app_realtime.py
```

Canonical backend port:

```text
50505
```

Canonical local backend endpoints:

```text
HTTP:
http://127.0.0.1:50505

Realtime WebSocket:
ws://127.0.0.1:50505/voice/ws
```

Current Web endpoint configuration file:

```text
apps/web-ui/src/config/runtimeConfig.js
```

Current Web `.env.example`:

```env
VITE_REALTIME_HTTP=http://127.0.0.1:50505
VITE_REALTIME_WS=ws://127.0.0.1:50505/voice/ws
```

Current Web backend API usage is read-only:

```text
GET /v1/provider/config
GET /v1/provider/capabilities
GET /v1/scenarios
```

Current Web API clients:

```text
apps/web-ui/src/api/providerClient.js
apps/web-ui/src/api/scenarioClient.js
```

Do not create a new backend for Web.

Do not fork backend behavior for Web unless explicitly approved in a separate architecture phase.

---

## 6. Current Web UI Direction

The Web UI must mirror the Desktop app as closely as possible within browser constraints.

Desktop source-of-truth files for UI parity:

```text
Desktop/renderer/index.html
Desktop/renderer/styles.css
Desktop/renderer/renderer.js
```

Use Desktop `renderer.js` only to understand:

```text
visible UI state
labels
page behavior concepts
status names
data bindings
disabled/read-only equivalents
```

Do not copy Electron-specific runtime code.

Current Web UI pages:

```text
Voice
Settings
Scenarios
```

Current Web shell:

```text
AnswerDesk AI
Realtime Voice
disabled/read-only header language selector placeholder
Voice / Settings / Scenarios nav
Desktop-like bottom status bar
```

Current Web visual style:

```text
dark navy/black shell
glassmorphism panels
compact dashboard density
blue/green accent system
warning/error states
status pills
settings cards
scenario panels
responsive layout
```

---

## 7. Web Page Baseline

### Voice page

Current Web Voice page mirrors Desktop structure in read-only form:

```text
Voice Session main card
Selected Scenario summary
Session: OFF pill
Activity: Idle pill
Cost Guard notice placeholder
AI visual block
Realtime rate placeholder/read-only
Realtime volume placeholder/read-only
Output device placeholder/read-only
disabled quick controls:
  Start Direct Realtime
  Stop
  Refresh Instructions
  Repeat Last Answer
  Reset Session
Realtime Status side card
Activity side card
```

Current Voice page is presentation/read-only only.

### Settings page

Current Web Settings page mirrors Desktop structure in read-only form:

```text
Connection card
Audio Output card
Audio Safety section
Session Cost Guard card
Provider Configuration card
Application Update placeholder
Diagnostics / Log card
```

Current Settings provider data is read-only from existing backend provider endpoints.

No provider save/test is implemented.

### Scenarios page

Current Web Scenarios page mirrors Desktop structure in read-only form:

```text
Scenario & Instructions header
Selected Scenario panel
Scenario Library grid
Scenario Preview
Scenario Details
Current Instructions read-only panel
Scenario Default Instructions read-only panel
Instruction State panel
```

Current Scenarios data is read-only from existing backend scenario endpoint.

No scenario save/edit/delete is implemented.

---

## 8. Current Validation Baseline

Confirmed after Web Phase 4:

```text
apps/web-ui npm build: OK
Desktop syntax checks: OK
  node --check Desktop/electron/main.cjs
  node --check Desktop/electron/preload.cjs
  node --check Desktop/renderer/renderer.js
Desktop/ was not modified.
backend/ was not modified.
Web UI loads backend provider/scenario data when backend is running.
Web UI shows active scenario and scenario instruction panels.
Web UI displays Desktop-like layout after Phase 4.
```

Current local Web runtime test:

```text
Backend running on http://127.0.0.1:50505
Web dev server running on http://127.0.0.1:5173/
GET /v1/provider/capabilities -> 200 OK
GET /v1/provider/config -> 200 OK
GET /v1/scenarios -> 200 OK
Web UI displayed loaded scenario data after browser refresh.
```

Known non-blocking backend log observation during browser fetch:

```text
ConnectionResetError [WinError 10054] may appear when browser closes a local HTTP connection.
If GET endpoints return 200 OK and Web UI loads data, this is not currently treated as a Web Phase 4 blocker.
```

---

## 9. Current Web Boundaries

Current Web app must not implement yet:

```text
browser audio capture
getDisplayMedia runtime
getUserMedia microphone input
Realtime WebSocket connection
Start Direct Realtime
Stop Direct Realtime
audio playback
output device routing
provider save
provider test connection
scenario save/edit/delete
instruction save/edit/refresh
backend process management
AppData/userData runtime management
Mini Control Window behavior
Electron IPC
Desktop packaged app updater behavior
```

Forbidden paths:

```text
STT backend
Orchestrator backend
Agent1 runtime path
Control WebSocket
TTS engine path
Manual answer backend
old frontend/Vite runtime resurrection
Full Pipeline Test flow
```

The Web app must not reintroduce the old CHATT multi-service architecture.

---

## 10. Web vs Desktop Ownership

Desktop owns:

```text
Electron lifecycle
loopback/system audio capture
Realtime Start/Stop runtime
Realtime WebSocket runtime
audio playback pipeline
selected output/headphones sink
Mini Control Window
Electron IPC
packaging and installer
AppData/userData runtime migration for packaged app
```

Backend owns:

```text
provider configuration API
provider capabilities API
scenario API
instructions API
Realtime provider adapter runtime
/voice/ws provider bridge
session.update payload construction
language steering
server VAD configuration
```

Web currently owns:

```text
browser UI shell
Desktop-parity page presentation
read-only provider/scenario display
runtime endpoint config
browser dev/build lifecycle
future browser runtime implementation phases
```

---

## 11. Web Startup

Start backend from:

```powershell
cd C:\Projects\chatt-direct\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

Start Web UI from:

```powershell
cd C:\Projects\chatt-direct\apps\web-ui
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Build Web UI:

```powershell
cd C:\Projects\chatt-direct\apps\web-ui
npm.cmd run build
```

---

## 12. Validation Commands Before Web Commits

Before committing Web changes:

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

If backend files are changed, also run backend validation from the main canonical files.

For normal Web UI-only changes, backend validation is not required unless backend behavior was touched.

---

## 13. Work Process Rules for Web

For all Web work:

```text
Analyze first.
Inspect relevant existing Desktop/backend/Web files before scripting edits.
Plan second.
Change code third.
One phase at a time.
No broad refactor without diff review.
No commit before visual/runtime validation when UI is changed.
Always use exact paths.
Do not guess backend endpoint shapes.
Use existing backend as source of truth.
Use Desktop UI as source of truth for visual parity.
```

For Codex Web work:

```text
Run git status --short before Codex.
For inspect tasks, Codex must not modify files.
After Codex, run git status --short --untracked-files=all immediately.
Inspect git diff --name-status and git diff --stat.
For untracked files, inspect file contents before commit.
Do not commit based only on git diff because untracked files do not appear in normal diff.
Do not allow Codex to change Desktop/ or backend/ unless explicitly approved.
```

---

## 14. Next Candidate Web Phases

Next candidate Web work should not start with audio.

Recommended order:

```text
Phase 5: Web UI parity refinement after visual review
  - density/scroll tuning
  - textarea/browser scrollbar polish
  - desktop label parity cleanup
  - read-only warning text cleanup

Phase 6: Web backend CORS/proxy decision if needed
  - only if browser runtime requires stable cross-origin handling
  - do not change backend unless confirmed necessary

Phase 7: Browser audio feasibility design
  - inspect browser getDisplayMedia constraints
  - define browser-only limitations
  - no implementation until design is accepted

Phase 8: Browser audio capture proof of concept
  - only getDisplayMedia system/tab audio
  - no microphone input
  - no WebSocket audio streaming until capture is validated

Phase 9: Web Realtime WebSocket integration
  - use existing /voice/ws only
  - preserve backend/provider adapter runtime
  - no new backend

Phase 10: Browser playback and output safety
  - AudioContext playback
  - optional setSinkId only where supported
  - clear browser-output limitations
```

Do not implement audio/WebSocket before UI parity is accepted and committed.

---

## 15. Current Web Known Good State

Current known good Web state:

```text
Working tree clean after commit 4a163e5.
Web Phase 1-4 commits are on main.
apps/web-ui builds successfully.
Web app opens in browser.
Web app reads existing backend provider/scenario endpoints.
Web app displays Desktop-like Voice/Settings/Scenarios layout.
Desktop app syntax validation still passes.
Desktop and backend were not changed by Web UI parity work.
```

Current last five Web-related commits:

```text
4a163e5 Align web UI with desktop layout
ef779b5 Fix web app React import
58511dd Add read-only web backend integration
4a56d1c Add web runtime config layer
e74ca40 Add initial web UI skeleton
```

---

## 16. Commercial Direction for Web

The Web app may later support an Azure-hosted deployment, but current Web baseline is local/dev only.

Potential future Web deployment model:

```text
Web frontend:
Azure Static Web Apps or Azure App Service static hosting

Backend:
Azure Container Apps running existing backend/app_realtime.py

Runtime endpoints:
VITE_REALTIME_HTTP=https://<backend-host>
VITE_REALTIME_WS=wss://<backend-host>/voice/ws
```

Current rule:

```text
No frontend secrets.
Provider/API keys remain backend-side.
Browser Web app must not call OpenAI/Azure OpenAI provider APIs directly.
```

Future Azure Web work must be planned separately and must not reintroduce obsolete Azure Static Web Apps workflows from the removed legacy frontend.
