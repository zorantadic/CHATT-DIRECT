# CHATT Canonical Project State

Last updated: 2026-05-15

## 1. Purpose

This file is the canonical working reference for the CHATT project refactoring and improvement work.

Its purpose is to keep the project direction stable, avoid repeated re-analysis, and give Codex precise context before any inspect-only or coding task.

This file must be updated whenever we make a confirmed architectural decision.

---

## 2. Project Scope

The project is a personal-use real voice chat system with:

- Desktop Electron Windows app
- Shared Python backend services
- STT (Speech-to-Text)
- Orchestrator
- Agent1 question extraction/formulation
- Realtime voice answer engine
- TTS (Text-to-Speech) answer engine
- Controlled headphone-only audio playback

Current focus:

```text
Desktop Electron app + local backend services
```

Out of current scope:

```text
web frontend
manual-backend
manual-frontend
Manual-desktop
DesktopMic
deploy/cloud deployment
Docker/Azure Container Apps deployment
```

Docker images and Azure Container Apps deployment will be handled only after the local Desktop + backend workflow is stable.

---

## 3. Current Development Strategy

Development must be local-first.

Current target workflow:

```text
Desktop Electron app
→ local backend services
→ Azure AI services
```

Local backend services:

```text
50505 → Realtime/TTS backend
50506 → Orchestrator
50507 → STT backend
```

Docker is not used during active development.

After local validation:

```text
local stable version
→ Docker images
→ Azure Container Apps
```

---

## 4. Main Runtime Scenario

The main scenario is:

```text
browser/web-session/system audio
→ STT (Speech-to-Text)
→ Orchestrator
→ Agent1 model
→ Orchestrator
→ Realtime voice model or TTS model
→ headphones only
```

Important:

The Desktop app captures audio from the browser/web-session/system audio source.

Microphone audio must never be routed to STT in the main scenario.

---

## 5. Non-Negotiable Principles

### 5.1 Microphone Safety

In the main scenario:

```text
microphone → STT
```

is forbidden.

STT must receive only captured browser/web-session/system audio.

### 5.2 Headphones-Only Playback

Voice model output must play only through the selected headphones/output device.

Speakers must not be used as an automatic fallback.

If a valid output device is not available or cannot be confirmed, playback should not start automatically.

### 5.3 Auto Send Must Remain Fast

Auto Send is the default low-latency mode.

New controls must not slow down the default Auto Send path.

### 5.4 Review Queue Is Optional

Review Before Send and Pending Question Queue must be optional.

They provide extra control but may add intentional user-controlled delay.

### 5.5 No Unnecessary Enterprise Complexity

This is a personal-use application.

Avoid unnecessary enterprise formalities such as:

- complex audit systems
- multi-user role model
- database persistence unless clearly needed
- policy engine
- cloud deployment automation during local development

---

## 6. Confirmed Active Backend Services

### 6.1 Realtime/TTS Backend

Service:

```text
backend/app_realtime.py
```

Port:

```text
50505
```

Primary paths:

```text
GET /
GET /v1/instructions
PUT /v1/instructions
POST /v1/instructions/reset
GET /instruction_profiles.json
WS  /voice/ws
```

Responsibilities:

- Realtime voice bridge
- TTS streaming bridge
- instruction APIs
- instruction profile file serving

### 6.2 Orchestrator

Service:

```text
backend/orchestrator/server.py
```

Port:

```text
50506
```

Primary paths:

```text
WS   /v1/control/{session_id}
POST /v1/sessions/{session_id}/transcripts
POST /v1/sessions/{session_id}/turns/{turn_id}/done
```

Responsibilities:

- receives final STT transcript
- calls Agent1
- receives formulated question(s)
- manages question queue and active turn
- sends control command `SEND_TO_REALTIME`
- receives `turn_done`

### 6.3 STT Backend

Service:

```text
backend/speech_server.py
```

Port:

```text
50507
```

Primary path:

```text
WS /stt/ws/{session_id}
```

Responsibilities:

- receives PCM16 16 kHz mono audio stream
- sends audio to Azure Speech SDK
- handles STT partial/final recognition
- uses STT context buffering
- returns consolidated STT final transcript

---

## 7. Current Desktop Runtime Flow

Confirmed flow:

```text
Desktop app startup
→ loopback/session audio capture
→ AudioWorklet downsample to PCM16 16 kHz
→ STT WS /stt/ws/{sessionId}
→ Azure Speech SDK
→ STT_FINAL
→ Desktop POST transcript to Orchestrator
→ Orchestrator calls Agent1
→ Agent1 formulates question(s)
→ Orchestrator queue + active_turn_id
→ Control WS sends SEND_TO_REALTIME
→ Desktop sends SEND_TEXT to /voice/ws?engine=realtime|tts
→ Realtime/TTS backend produces audio
→ Desktop playback queue
→ selected headphones/output device
→ agent_done
→ Desktop POST turn_done
→ Orchestrator dispatches next queued question
```

---

## 8. Existing Desktop Capabilities

The Desktop app already has or partially has:

- loopback/session audio capture
- STT enabled/language controls
- STT WebSocket connection
- Orchestrator Control WebSocket connection
- `SEND_TO_REALTIME` handling
- Realtime/TTS engine selection
- Realtime speech rate selection: `1.0`, `0.9`, `0.8`
- instruction prompt settings
- instruction profile/preset files
- selected output device logic
- `setSinkId` output routing where supported
- headphones-only behavior concept
- audio queue/buffer
- pause audio behavior
- logs/status indicators

---

## 9. Important Known Risks

### 9.1 Output Device Risk

If `setSinkId` is unsupported or no headphones device is found before playback, the audio element may remain on the platform default output device.

Required future fix:

```text
if output device is not confirmed, do not start playback automatically
```

### 9.2 Desktop Defaults Point to Cloud

Current Desktop default endpoint settings point to Azure Container Apps, not localhost.

For local development, Desktop settings must be changed to:

```text
STT WS base:          ws://127.0.0.1:50507/stt/ws
Orchestrator HTTP:    http://127.0.0.1:50506
Control WS base:      ws://127.0.0.1:50506/v1/control
Realtime HTTP:        http://127.0.0.1:50505
Realtime WS:          ws://127.0.0.1:50505/voice/ws
```

Risk:

`Reset settings to defaults` may return Desktop to cloud URLs.

### 9.3 Backend Local Startup Is Not Clean Yet

Existing `start_all.ps1` starts backend, web, and manual services.

For Desktop-focused work, we need backend-only scripts:

```text
start_backend_local.ps1
stop_backend_local.ps1
```

### 9.4 STT_RECO_MODE Risk

`STT_RECO_MODE` may be read but not actually applied.

This needs later verification before relying on it as a runtime control.

### 9.5 Agent1 Import-Time Startup Risk

Orchestrator may create Agent1 client at import/startup.

If Agent1 environment variables are missing, service startup can fail.

Preferred future improvement:

```text
service should start even if Agent1 is not ready;
Agent1 errors should appear at runtime with clear status
```

---

## 10. Required Local Backend Environment Variables

Minimum for local Desktop Realtime flow:

```text
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
AGENT1_PROJECT_ENDPOINT
AGENT1_AGENT_ID
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_KEY
```

Required for TTS engine:

```text
AZURE_OPENAI_TTS_DEPLOYMENT
```

or:

```text
AZURE_OPENAI_TTS_DEPLOYMENT_NAME
```

Azure authentication:

The Orchestrator uses `DefaultAzureCredential`, so local Azure login or another valid identity is required for Agent1 access.

---

## 11. Optional/Tuning Environment Variables

### 11.1 STT

```text
STT_DEFAULT_LANGUAGE=en-US
STT_SEGMENTATION_STRATEGY=Semantic
STT_SEGMENTATION_SILENCE_TIMEOUT_MS=2000
STT_END_SILENCE_TIMEOUT_MS=2500
STT_INITIAL_SILENCE_TIMEOUT_MS=4000
STT_SEGMENTATION_MAXIMUM_TIME_MS=45000
STT_RECO_MODE=Conversation
STT_STABLE_PARTIAL_THRESHOLD=3
STT_CONTEXT_FLUSH_SILENCE_MS=<STT_END_SILENCE_TIMEOUT_MS>
```

### 11.2 Realtime

```text
DEBUG=False
AZURE_OPENAI_MODEL=gpt-realtime-mini
AZURE_OPENAI_API_VERSION=2025-05-01-preview
AZURE_OPENAI_PROFILE=byom-azure-openai-realtime
REALTIME_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
PORT=50505
```

### 11.3 TTS

```text
AZURE_OPENAI_TTS_ENDPOINT=<AZURE_OPENAI_ENDPOINT>
AZURE_OPENAI_TTS_KEY=<AZURE_OPENAI_KEY>
AZURE_OPENAI_TTS_API_VERSION=<AZURE_OPENAI_API_VERSION>
AZURE_OPENAI_TTS_MODEL=gpt-4o-mini-tts-2025-12-15
AZURE_OPENAI_TTS_VOICE=alloy
AZURE_OPENAI_TTS_RESPONSE_FORMAT=pcm
TTS_SAMPLE_RATE=24000
```

### 11.4 Instructions/Profiles

```text
INSTRUCTIONS_PATH=instructions.json
INSTRUCTION_PROFILES_PATH=instruction_profiles.json
MANUAL_ANSWERS_PATH=manual_answers.json
MAX_INSTRUCTIONS_LEN=8192
MAX_MANUAL_ANSWERS=10
MAX_MANUAL_ANSWER_LEN=4096
```

---

## 12. Planned Improvements

### 12.1 Backend Local Development Scripts

Create:

```text
start_backend_local.ps1
stop_backend_local.ps1
```

Purpose:

- start only backend services required by Desktop
- stop only backend ports `50505`, `50506`, `50507`
- avoid web/manual services
- simplify daily development

### 12.2 Voice Output Test

Add Desktop button:

```text
Test Voice Output
```

Requirements:

- one-click test
- use same playback path as Realtime/TTS output
- validate selected headphones/output device
- help verify volume
- no backend change required initially

### 12.3 Headphones-Only Safety Guard

Before playback:

- confirm valid selected output device
- confirm `setSinkId` success where supported
- if headphones/output device is not confirmed, block playback
- do not fallback automatically to speakers

### 12.4 Stop Audio Now

Add button:

```text
Stop Audio Now
```

Must immediately:

- stop local playback
- clear playback queue
- clear audio buffer
- send backend cancel/stop if supported

Initial implementation may be Desktop-only.

### 12.5 Stop Before Sending to Voice Model

Before Desktop sends `SEND_TEXT` to Realtime/TTS backend, user should be able to stop or prevent sending when Review mode is enabled.

### 12.6 Auto Send vs Review Before Send

Two modes:

```text
Auto Send
Review Before Send
```

Auto Send:

```text
STT → Agent1 → formulated question → voice model immediately
```

Review Before Send:

```text
STT → Agent1 → formulated question → Pending Question Queue → user selects/sends
```

Auto Send remains default.

Review Before Send is optional.

### 12.7 Pending Question Queue

Review mode queue should support:

- show formulated questions
- click/send selected question
- edit question
- delete question
- clear queue

For personal use, `Hold` is optional and can be skipped initially.

### 12.8 STT Presets

Add simple Desktop STT modes:

```text
Fast
Balanced
Careful
Custom
```

Purpose:

- Fast: lowest latency, higher risk of cutting off longer thought
- Balanced: default compromise
- Careful: waits longer for pauses and longer context
- Custom: manual tuning

Initial custom controls should be limited to:

```text
context flush silence
segmentation silence
end silence
maximum segment time
```

### 12.9 Runtime STT Tuning

Eventually allow runtime control from Desktop UI for selected STT settings.

Container/App/env variables remain defaults only.

### 12.10 Latency Panel

Add simple timing visibility:

```text
STT latency
Agent1 latency
Orchestrator latency
Realtime first-audio latency
Playback latency
Total turn latency
```

This is for debugging and optimization, not enterprise telemetry.

### 12.11 Improved Instruction Prompt Workflow

Keep existing default prompt behavior.

Add or improve:

- preset selector
- editable template
- short extra instruction/override
- reset to default

Default prompt must work immediately without user changes.

---

## 13. Preferred Implementation Order

### Phase 1: Local Backend Development

- create `start_backend_local.ps1`
- create `stop_backend_local.ps1`
- optionally add `backend/.env.example`
- optionally add `docs/backend-local-run.md`

### Phase 2: Audio Safety

- Voice Output Test
- headphones-only guard
- Stop Audio Now

### Phase 3: Question Control

- Auto Send vs Review Before Send
- Pending Question Queue
- send/edit/delete/clear

### Phase 4: STT Control

- STT preset modes
- limited custom runtime STT settings

### Phase 5: Prompt Workflow

- default prompt
- presets
- short override
- reset to default

### Phase 6: Latency Panel

- simple per-turn timing display

---

## 14. Codex Workflow Rules

Codex must receive small, precise tasks.

Preferred process:

```text
1. define one small task
2. Codex inspects or edits
3. immediately run git status --short
4. inspect changed files
5. inspect git diff --name-status
6. inspect git diff --stat
7. inspect full git diff
8. test locally
9. commit only if working
```

If Codex creates untracked files, do not rely only on `git diff`.

Use one of:

```text
inspect file content directly
```

or:

```text
git add -N <file>
git diff -- <file>
```

Do not commit until the app is tested.

---

## 15. Assistant Workflow Rules

The assistant must work step by step.

Rules:

- do not skip steps
- give no more than one or two tasks at a time
- always ask whether the previous task is completed before giving the next task
- before coding, explain what will change and why
- when writing or modifying a file, return the complete file
- if shortening is unavoidable, clearly state exactly what was shortened and why
- keep responses short unless detailed analysis is requested
- do not move to the next phase without user confirmation

---

## 16. Current Next Step

The next planned step is Phase 1:

```text
create backend-only local start/stop scripts
```

But before implementation, confirm:

```text
git status --short
```

from:

```text
C:\Projects\chatt
```

Expected result:

```text
no output
```
