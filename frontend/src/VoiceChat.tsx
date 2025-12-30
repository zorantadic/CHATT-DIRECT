import { useEffect, useRef, useState } from "react";
import InstructionsPage from "./InstructionsPage";

const REALTIME_HTTP = import.meta.env.VITE_REALTIME_HTTP;
const REALTIME_WS = import.meta.env.VITE_REALTIME_WS;

const ORCH_HTTP = import.meta.env.VITE_ORCH_HTTP;
const ORCH_CONTROL_WS = (sid: string) =>
  `${import.meta.env.VITE_ORCH_CONTROL_WS}/${sid}`;

const STT_WS = (sid: string) =>
  `${import.meta.env.VITE_STT_WS}/${sid}`;


type InstructionsResp = {
  current: string;
  updatedAt: string;
};

type ControlCommand =
  | {
      command: "SEND_TO_REALTIME";
      payload: { turnId: string; text: string };
    }
  | { command: string; payload?: any };

type SttMsg =
  | { type: "STT_FINAL"; sessionId: string; transcript: string; confidence?: number | null }
  | { type: "STT_ERROR"; sessionId?: string; error: string };

type AudioMsg = {
  type: "audio";
  format?: string;
  sample_rate: number;
  channels?: number;
  data: string; // base64 PCM16
};

export default function VoiceChat() {
  const [view, setView] = useState<"chat" | "instructions">("chat");

  // -------- shared session id across STT + Orchestrator control + Orchestrator REST
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "test123"
  );

  // -------- UI state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isControlConnected, setIsControlConnected] = useState(false);
  const [isSttRunning, setIsSttRunning] = useState(false);

  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l, m]);

  // -------- Instructions (from realtime backend)
  const [currentInstr, setCurrentInstr] = useState("");
  const [instrUpdatedAt, setInstrUpdatedAt] = useState("");
  const latestInstrRef = useRef<string>("");
  useEffect(() => {
    latestInstrRef.current = currentInstr;
  }, [currentInstr]);

  const loadInstructions = async () => {
    const res = await fetch(`${REALTIME_HTTP}/v1/instructions`);
    const data = (await res.json()) as InstructionsResp;
    setCurrentInstr(data.current ?? "");
    setInstrUpdatedAt(data.updatedAt ?? "");
  };

  // -------- Refs / sockets
  const realtimeWsRef = useRef<WebSocket | null>(null);
  const controlWsRef = useRef<WebSocket | null>(null);
  const sttWsRef = useRef<WebSocket | null>(null);

  // -------- Audio playback (Realtime)
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef<number>(0);

  // -------- STT capture
  const sttCtxRef = useRef<AudioContext | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);

  // -------- Orchestrator turn tracking
  const activeTurnIdRef = useRef<string | null>(null);

  // -------- STT buffering
  const sttBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const [sttBufferedText, setSttBufferedText] = useState<string>("");

  // Tune flush timing
  const FLUSH_MS = 1200;

  // -----------------------------
  // Realtime playback helper
  // -----------------------------
  const playAudio = (pcm16: Int16Array, sampleRate: number, channels: number) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const ch = Math.max(1, channels || 1);
    const frameCount = Math.floor(pcm16.length / ch);
    if (frameCount <= 0) return;

    const buffer = ctx.createBuffer(ch, frameCount, sampleRate);

    for (let c = 0; c < ch; c++) {
      const channelData = buffer.getChannelData(c);
      let idx = c;
      for (let i = 0; i < frameCount; i++, idx += ch) {
        channelData[i] = pcm16[idx] / 32768;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    if (playheadRef.current < now) playheadRef.current = now;

    src.start(playheadRef.current);
    playheadRef.current += buffer.duration;
  };

  // -----------------------------
  // Realtime WS (text IN, audio OUT, agent_done OUT)
  // -----------------------------
  useEffect(() => {
    playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });

    loadInstructions().catch(() => push("Failed to load instructions"));

    const ws = new WebSocket(REALTIME_WS);
    realtimeWsRef.current = ws;

    ws.onopen = () => {
      setIsRealtimeConnected(true);
      push("Realtime WS connected");
    };

    ws.onmessage = async (e) => {
      if (typeof e.data !== "string") return;

      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "audio") {
        const audio = msg as AudioMsg;
        const pcmBytes = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
        const pcm16 = new Int16Array(
          pcmBytes.buffer,
          pcmBytes.byteOffset,
          Math.floor(pcmBytes.byteLength / 2)
        );
        playAudio(pcm16, audio.sample_rate, audio.channels ?? 1);
        return;
      }

      // Critical integration hook: agent_done -> Orchestrator turn_done
      if (msg.type === "agent_done") {
        const turnId = activeTurnIdRef.current;
        if (!turnId) {
          push("agent_done received but no activeTurnId");
          return;
        }

        push(`agent_done (turnId=${turnId})`);
        activeTurnIdRef.current = null;

        try {
          await fetch(`${ORCH_HTTP}/v1/sessions/${sessionIdRef.current}/turns/${turnId}/done`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {
          push("Orchestrator turn_done POST failed");
        }
      }
    };

    ws.onclose = () => {
      setIsRealtimeConnected(false);
      push("Realtime WS closed");
    };

    ws.onerror = () => {
      push("Realtime WS error");
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      realtimeWsRef.current = null;

      try {
        playbackCtxRef.current?.close();
      } catch {
        // ignore
      }
      playbackCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Orchestrator Control WS (COMMAND channel)
  // -----------------------------
  useEffect(() => {
    const sid = sessionIdRef.current;
    const ws = new WebSocket(ORCH_CONTROL_WS(sid));
    controlWsRef.current = ws;

    ws.onopen = () => {
      setIsControlConnected(true);
      push(`Control WS connected (sessionId=${sid})`);
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;

      let cmd: ControlCommand;
      try {
        cmd = JSON.parse(e.data);
      } catch {
        return;
      }

      if (cmd.command === "SEND_TO_REALTIME") {
        const { turnId, text } = cmd.payload;

        push(`COMMAND SEND_TO_REALTIME (turnId=${turnId})`);
        activeTurnIdRef.current = turnId;

        const finalText = `INSTRUCTIONS:\n${latestInstrRef.current}\n\nUSER QUESTION:\n${text}`;

        if (realtimeWsRef.current?.readyState === WebSocket.OPEN) {
          realtimeWsRef.current.send(JSON.stringify({ type: "SEND_TEXT", text: finalText }));
        } else {
          push("Realtime WS not open; cannot SEND_TEXT");
        }
      }
    };

    ws.onclose = () => {
      setIsControlConnected(false);
      push("Control WS closed");
    };

    ws.onerror = () => {
      push("Control WS error");
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      controlWsRef.current = null;
    };
  }, []);

  // -----------------------------
  // STT buffer flush → Orchestrator transcripts
  // -----------------------------
  const flushSttBuffer = async () => {
    if (sttBufferRef.current.length === 0) return;

    const full = sttBufferRef.current.join(" ").replace(/\s+/g, " ").trim();
    sttBufferRef.current = [];
    setSttBufferedText(full);

    push(`STT_BUFFER_FLUSH: ${full}`);

    try {
      await fetch(`${ORCH_HTTP}/v1/sessions/${sessionIdRef.current}/transcripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: full }),
      });
    } catch {
      push("Orchestrator transcripts POST failed");
    }
  };

  // -----------------------------
  // Start / Stop STT (mic → Speech Server)
  // -----------------------------
  const startStt = async () => {
    try {
      if (isSttRunning) return;

      // reset buffer
      sttBufferRef.current = [];
      setSttBufferedText("");
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      mediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sid = sessionIdRef.current;

      const sttWs = new WebSocket(STT_WS(sid));
      sttWs.binaryType = "arraybuffer";
      sttWsRef.current = sttWs;

      sttWs.onopen = () => {
        push("STT WS connected");
      };

      sttWs.onmessage = (evt) => {
        if (typeof evt.data !== "string") return;

        let msg: SttMsg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (msg.type === "STT_FINAL") {
          const chunk = (msg.transcript || "").trim();
          if (!chunk) return;

          push(`STT_FINAL: ${chunk}`);

          // buffer it
          sttBufferRef.current.push(chunk);

          // flush heuristic:
          const endsSentence = /[?.!]\s*$/.test(chunk);

          if (flushTimerRef.current) {
            window.clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }

          const timeout = endsSentence ? 450 : FLUSH_MS;

          flushTimerRef.current = window.setTimeout(() => {
            flushSttBuffer();
            flushTimerRef.current = null;
          }, timeout);
        } else if (msg.type === "STT_ERROR") {
          push(`STT_ERROR: ${msg.error}`);
        }
      };

      sttWs.onclose = () => {
        push("STT WS closed");
      };

      sttWs.onerror = () => {
        push("STT WS error");
      };

      // AudioWorklet path: we assume existing file in /public.
      // Processor name expected: "stt-pcm16-16k"
      const sttCtx = new AudioContext();
      sttCtxRef.current = sttCtx;

      const src = sttCtx.createMediaStreamSource(mediaRef.current);

      await sttCtx.audioWorklet.addModule("/stt-worklet-processor.js");
      const node = new AudioWorkletNode(sttCtx, "stt-pcm16-16k");

      node.port.onmessage = (e) => {
        if (sttWsRef.current?.readyState === WebSocket.OPEN) {
          sttWsRef.current.send(e.data); // ArrayBuffer PCM16 @ 16k
        }
      };

      src.connect(node);

      setIsSttRunning(true);
      push("STT started");
    } catch (e) {
      console.error(e);
      push("STT start error");
    }
  };

  const stopStt = () => {
    try {
      if (!isSttRunning) return;

      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      sttBufferRef.current = [];

      try {
        sttWsRef.current?.close();
      } catch {
        // ignore
      }
      sttWsRef.current = null;

      try {
        mediaRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaRef.current = null;

      try {
        sttCtxRef.current?.close();
      } catch {
        // ignore
      }
      sttCtxRef.current = null;

      setIsSttRunning(false);
      push("STT stopped");
    } catch {
      push("STT stop error");
    }
  };

  // -----------------------------
  // Instructions view
  // -----------------------------
  if (view === "instructions") {
    return (
      <InstructionsPage
        onBack={() => {
          loadInstructions().catch(() => push("Failed to reload instructions"));
          setView("chat");
        }}
      />
    );
  }

  // -----------------------------
  // UI
  // -----------------------------
  const canStartStt = isRealtimeConnected && isControlConnected;

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Voice Chat</h2>

      <div style={{ fontSize: 13, opacity: 0.9 }}>
        <div>
          <strong>SessionId:</strong> {sessionIdRef.current}
        </div>
        <div>
          <strong>Realtime:</strong> {isRealtimeConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <div>
          <strong>Control:</strong> {isControlConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <div>
          <strong>STT:</strong> {isSttRunning ? "RUNNING" : "STOPPED"}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setView("instructions")}>Open Instructions</button>

        <button
          onClick={() => window.open("http://localhost:5173/", "ManualFrontend", "noopener,noreferrer")}
          style={{ marginLeft: 8 }}
        >
          Open Manual
        </button>

        <button
          onClick={isSttRunning ? stopStt : startStt}
          style={{ marginLeft: 8 }}
          disabled={!canStartStt}
          title={!canStartStt ? "Realtime + Control must be connected" : ""}
        >
          {isSttRunning ? "Stop STT" : "Start STT"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 6 }}>Active Instructions (read-only)</h4>
        <textarea
          value={currentInstr}
          readOnly
          rows={6}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div style={{ fontSize: 12 }}>updatedAt: {instrUpdatedAt}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 6 }}>STT (buffered)</h4>
        <pre style={{ background: "#f4f4f4", padding: 10, whiteSpace: "pre-wrap" }}>
          {sttBufferedText || "(nema)"}
        </pre>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 6 }}>Log</h4>
        <pre style={{ background: "#eee", padding: 10, whiteSpace: "pre-wrap" }}>
          {log.join("\n")}
        </pre>
      </div>
    </div>
  );
}
