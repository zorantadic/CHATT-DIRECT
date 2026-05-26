# CHATT Direct Web UI

Initial Vite React skeleton for a parallel CHATT Direct web interface.

This skeleton intentionally does not implement audio capture, microphone access,
Realtime WebSocket streaming, or legacy STT/Orchestrator/TTS/manual runtime paths.

## Setup

```powershell
cd C:\Projects\chatt-direct\apps\web-ui
npm install
npm run dev
```

## Configuration

Copy `.env.example` to `.env.local` if local endpoint overrides are needed.

```env
VITE_REALTIME_HTTP=http://127.0.0.1:50505
VITE_REALTIME_WS=ws://127.0.0.1:50505/voice/ws
```
