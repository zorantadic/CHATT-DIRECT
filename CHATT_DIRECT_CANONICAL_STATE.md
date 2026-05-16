# CHATT Direct Canonical State

Last updated: 2026-05-16

This file is the canonical working state for the CHATT Direct project.
Use it as the first reference before making architecture, configuration, Desktop, backend, or deployment changes.

---

## 1. Project Purpose

CHATT Direct is a separate project copied from the original CHATT codebase.

The purpose of this project is to validate and build a low-latency Direct Realtime Voice scenario.

Canonical direct scenario:

```text
Windows/Electron Desktop app
→ loopback/system/browser audio capture
→ Azure OpenAI Realtime model audio input
→ Azure OpenAI Realtime model audio output
→ selected headphones/output device
```

This project is not the same as the original orchestrated CHATT flow.

Original CHATT remains frozen separately for:

```text
STT → Orchestrator → Agent1 → Realtime/TTS
```

CHATT Direct is focused on:

```text
system/browser audio → Realtime model → headphones
```

---

## 2. Current Runtime Architecture

Active runtime flow:

```text
Electron Desktop session owner
→ existing /voice/ws backend WebSocket
→ Azure Realtime session
→ Realtime VAD / interruption
→ audio response
→ Desktop playback path
→ headphones
```

The Windows/Electron app is the session owner.

There must be only one active Realtime voice connection for the direct scenario.

The active direct runtime does not require:

```text
STT backend
Orchestrator backend
Agent1
Control WebSocket
SEND_TO_REALTIME
postTranscript
postTurnDone
```

Old code may still exist temporarily, but it is not part of the active direct runtime.

---

## 3. Critical Audio Source Rule

Direct Realtime input must use the same loopback/system-audio capture pattern that was previously used for STT.

This is required because that path already ensures that the app captures audio coming from the system/browser/speaker side, not microphone input.

Do not use:

```text
navigator.mediaDevices.getUserMedia
microphone input
any new microphone capture path
any user microphone permission flow
```

Use only:

```text
electronAPI.enableLoopbackAudio()
navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
stop/remove video tracks immediately
use only the returned system audio track
```

Canonical source rule:

```text
Realtime model input = loopback/system/browser audio only.
Microphone must not be used.
```

---

## 4. Local Project Paths

Local project root:

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

Default branch:

```text
main
```

---

## 5. Active Backend Service

For Direct Realtime, the only required backend service is:

| Service | File | Port | Purpose |
|---|---|---:|---|
| Realtime backend | `backend/app_realtime.py` | 50505 | Direct Realtime audio bridge |

Run from:

```text
C:\Projects\chatt-direct\backend
```

Command:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

Expected local endpoint:

```text
http://127.0.0.1:50505
```

Expected Realtime WebSocket:

```text
ws://127.0.0.1:50505/voice/ws
```

The STT and Orchestrator services may still exist in the copied project, but they are not needed for the active direct runtime.

---

## 6. Desktop Startup

Run from:

```text
C:\Projects\chatt-direct\Desktop
```

Command:

```powershell
npm start
```

This starts the Electron Desktop app.

---

## 7. Direct Realtime Endpoint Settings

For local testing, Desktop Realtime settings should use:

```text
Realtime HTTP
http://127.0.0.1:50505

Realtime WS
ws://127.0.0.1:50505/voice/ws
```

The active Direct Realtime mode uses the existing `/voice/ws` path.

No `/direct-voice/ws` endpoint should be introduced for the current design.

---

## 8. Implemented Direct Realtime Behavior

Implemented active flow:

```text
Desktop loopback/system audio
→ PCM16 mono 24 kHz worklet output
→ existing rtWs connection
→ backend /voice/ws
→ Azure Realtime input_audio_buffer.append
→ Azure server_vad
→ Azure Realtime response.audio.delta / response.output_audio.delta
→ backend forwards { type: "audio" }
→ Desktop playPcm16()
→ selected headphones/output device
```

Azure Realtime session configuration for direct mode includes:

```text
input_audio_format: pcm16
output_audio_format: pcm16
modalities: ["audio"]
turn_detection:
  type: server_vad
  create_response: true
  interrupt_response: true
```

The backend forwards binary PCM16 audio frames from Desktop to Azure Realtime using:

```text
input_audio_buffer.append
```

The backend forwards Azure audio output back to Desktop using the existing shape:

```json
{
  "type": "audio",
  "format": "pcm16",
  "sample_rate": 24000,
  "channels": 1,
  "data": "<base64>"
}
```

---

## 9. Audio Worklet

Existing STT processor remains available:

```text
stt-pcm16-16k
```

Direct Realtime uses a separate processor:

```text
direct-realtime-pcm16-24k
```

Direct processor behavior:

```text
input Float32 audio from loopback capture
resample/downsample to 24000 Hz
clamp to [-1, 1]
convert to PCM16
post transferable pcm16.buffer
```

This keeps the previous STT path intact while enabling Direct Realtime 24 kHz audio input.

---

## 10. Desktop Controls

Primary direct control:

```text
Start Direct Realtime
```

This starts:

```text
playback setup
headphones sink verification
Realtime WebSocket connection
loopback/system audio capture
PCM16 audio streaming to /voice/ws
```

Stop control stops:

```text
loopback/system audio tracks
direct AudioContext/worklet
Realtime WebSocket streaming
local audio buffers
```

The previous `Connect Realtime` control may still exist as legacy UI, but the main direct runtime should be controlled by `Start Direct Realtime`.

---

## 11. Headphones / Output Safety

Realtime audio output must go through the selected headphones/output path.

The Desktop app already uses:

```text
rtOut.setSinkId(...)
playback AudioContext
MediaStreamDestination
playPcm16()
```

Direct Realtime must preserve headphones-only behavior.

If headphones/output sink is not available or cannot be verified, Direct Realtime should not start.

Do not allow fallback to speakers as a hidden behavior.

---

## 12. Speech Rate

Realtime speech rate selection works in Direct Realtime mode.

Confirmed values:

```text
1
0.9
0.8
```

Confirmed behavior:

```text
1   = normal/fast
0.9 = slower
0.8 = sufficiently slow for current preference
```

This setting must be preserved.

---

## 13. Confirmed Working State

Confirmed working locally:

```text
Direct Realtime stream starts
loopback/system audio reaches Realtime model
Azure VAD events are received
Realtime model responds with very low latency
Realtime audio plays through selected headphones
speech rate 1 / 0.9 / 0.8 works
0.8 is currently the preferred slower setting
```

Example observed log markers:

```text
Voice WS connected (engine=realtime rate=1)
Direct loopback audio tracks: 1
[0] label="System audio" enabled=true muted=false readyState=live
Direct AudioContext sampleRate=48000
Direct Realtime streaming started (loopback PCM16@24k mono -> /voice/ws)
direct realtime: input_audio_buffer.speech_started
direct realtime: input_audio_buffer.speech_stopped
direct realtime: input_audio_buffer.committed
RT_AUDIO: chunks=... sr=24000 ch=1
Direct Realtime response done
```

---

## 14. Test Procedure

1. Start backend:

```powershell
cd C:\Projects\chatt-direct\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app_realtime:app --host 127.0.0.1 --port 50505 --log-level info
```

2. Start Desktop:

```powershell
cd C:\Projects\chatt-direct\Desktop
npm start
```

3. Confirm selected output device is headphones.

4. Set Realtime rate, preferably:

```text
0.8
```

5. Click:

```text
Start Direct Realtime
```

6. In the Electron/Windows capture prompt, choose a source with system audio.

7. Play known browser/system audio.

8. Verify:

```text
speech_started / speech_stopped / committed events
RT_AUDIO logs
voice answer heard in headphones
no microphone capture
```

9. Stop Direct Realtime.

---

## 15. Current Known Risks

### 15.1 Echo / Self-Capture Risk

Because Direct Realtime listens to system/browser audio, there is a potential risk that model output could be captured again if routed into the same system audio capture source.

Current mitigation:

```text
output is routed to selected headphones via setSinkId
input capture is loopback/system audio selected by user prompt
```

This must be watched during testing.

### 15.2 Legacy UI Confusion

Some old controls may still exist, such as:

```text
Connect Realtime
STT controls
Full Pipeline Test
Orchestrator-related settings
```

For the Direct project, the main control should be:

```text
Start Direct Realtime
```

Legacy controls should be removed, hidden, or clearly marked later.

### 15.3 Instruction Prompt Tuning

Direct Realtime currently works, but prompt/instruction behavior still needs refinement.

Priority:

```text
concise answers
slow and clear speech
no unnecessary follow-up questions
allow interruption
respect selected speech rate
```

---

## 16. Planned Next Steps

Recommended next steps:

1. Clean up UI around Direct Realtime so there is one clear primary start/stop path.
2. Refine Direct Realtime instruction prompt.
3. Add persistent preferred rate default, likely 0.8.
4. Add Stop Audio Now / local playback buffer clear.
5. Test interruption/barge-in behavior with controlled input.
6. Remove or hide unused STT/Orchestrator/Agent1 controls from the Direct app.
7. Update packaging plan for a final standalone Windows app.

---

## 17. Work Rules

For future work on this project:

```text
Analyze first.
Then plan.
Then change code.
```

Do not use Codex for broad analysis when GitHub inspection is enough.

Use Codex mainly for large file edits after a precise implementation prompt is prepared.

After Codex changes:

```powershell
git status --short
git diff --name-status
git diff --stat
```

Always verify that no microphone capture path was introduced.

Search for:

```text
getUserMedia
microphone
```

These should not appear as active Direct Realtime capture paths.

---

## 18. Current Stable Milestone

Current stable milestone:

```text
Direct Realtime Voice Mode Phase 1 works locally with very low latency.
```

This is the baseline for Direct Realtime prompt tuning and UI cleanup.
