import { useEffect, useRef, useState } from "react";

const MANUAL_HTTP = (import.meta.env.VITE_MANUAL_HTTP as string).replace(/\/+$/, "");

const SAVE_ANSWERS_URL = MANUAL_HTTP + "/manual/answers";
const LOAD_ANSWERS_URL = MANUAL_HTTP + "/manual/answers";

const LOAD_INSTR_URL = MANUAL_HTTP + "/manual/instructions";
const SAVE_INSTR_URL = MANUAL_HTTP + "/manual/instructions";

type Engine = "tts" | "realtime";
type RealtimeRate = "1" | "0.9" | "0.8";

type ServerMsg =
  | { type: "audio"; data: string; sample_rate: number; channels: number }
  | { type: "agent_done" }
  | { type: "error"; message: string }
  | { type: "engine"; engine: string }
  | { type: "rate"; rate: string };

type ManualVoiceChatProps = {
  onBack: () => void;
};

function httpToWs(httpUrl: string): string {
  return httpUrl.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}

function buildManualWsUrl(engine: Engine, realtimeRate: RealtimeRate): string {
  const baseWs = httpToWs(MANUAL_HTTP);
  const url = new URL(`${baseWs}/manual/ws`);
  url.searchParams.set("engine", engine);

  // Only meaningful for realtime
  if (engine === "realtime") {
    url.searchParams.set("rate", realtimeRate);
  }

  return url.toString();
}

function loadSavedEngine(): Engine {
  const saved = (localStorage.getItem("manual_engine") || "").toLowerCase();
  return saved === "realtime" ? "realtime" : "tts";
}

function loadSavedRealtimeRate(): RealtimeRate {
  const saved = (localStorage.getItem("manual_realtime_rate") || "").trim();
  if (saved === "1" || saved === "0.9" || saved === "0.8") return saved;
  return "0.9";
}

function loadLocalInstructions(): string | null {
  const v = localStorage.getItem("manual_instructions_v1");
  if (typeof v === "string" && v.trim().length > 0) return v;
  return null;
}

function saveLocalInstructions(v: string) {
  localStorage.setItem("manual_instructions_v1", v);
}

function loadLocalAnswers(): string[] | null {
  const raw = localStorage.getItem("manual_answers_v1");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const src = parsed.map((x: unknown) => (typeof x === "string" ? x : String(x ?? "")));
    const padded =
      src.length >= 10 ? src.slice(0, 10) : [...src, ...Array.from({ length: 10 - src.length }, () => "")];
    return padded;
  } catch {
    return null;
  }
}

function saveLocalAnswers(v: string[]) {
  localStorage.setItem("manual_answers_v1", JSON.stringify(v));
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

type AudioChunk = {
  bytes: Uint8Array;
  sampleRate: number;
  channels: number;
};

export default function ManualVoiceChat({ onBack }: ManualVoiceChatProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef<number>(0);

  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l, m]);

  const [engine, setEngine] = useState<Engine>(() => loadSavedEngine());
  const [realtimeRate, setRealtimeRate] = useState<RealtimeRate>(() => loadSavedRealtimeRate());

  const [connectedEngine, setConnectedEngine] = useState<Engine | "unknown">("unknown");
  const [connectedRate, setConnectedRate] = useState<string>("unknown");

  const [instructions, setInstructions] = useState<string>(() => {
    const local = loadLocalInstructions();
    return (
      local ??
      `Read the provided text exactly as written.

Do not add, remove, rephrase, or summarize anything.
Do not explain, comment, or interpret the text.
Do not ask questions.
Do not greet or acknowledge the user.

Speak slowly, clearly, and with short pauses between sentences.
After finishing the text, stop speaking.`
    );
  });

  const [instructionsDirty, setInstructionsDirty] = useState<boolean>(false);

  // Default 10 boxes; backend also defaults to 10 via MAX_MANUAL_ANSWERS
  const [answers, setAnswers] = useState<string[]>(() => {
    const local = loadLocalAnswers();
    return local ?? Array.from({ length: 10 }, () => "");
  });

  // Pause/Resume + bounded buffer (120s)
  const BUFFER_SECONDS = 120;

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  const audioQueueRef = useRef<AudioChunk[]>([]);
  const bufferedBytesRef = useRef<number>(0);
  const lastFormatRef = useRef<{ sampleRate: number; channels: number } | null>(null);

  const [bufferedSeconds, setBufferedSeconds] = useState<number>(0);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const bytesPerSecond = (sampleRate: number, channels: number) => sampleRate * channels * 2;

  const clearBufferedAudio = () => {
    audioQueueRef.current = [];
    bufferedBytesRef.current = 0;
    lastFormatRef.current = null;
    setBufferedSeconds(0);
  };

  const updateBufferedSeconds = (sampleRate: number, channels: number) => {
    const bps = bytesPerSecond(sampleRate, channels);
    const secs = bps > 0 ? bufferedBytesRef.current / bps : 0;
    setBufferedSeconds(secs);
  };

  const enqueueAudio = (chunk: AudioChunk) => {
    audioQueueRef.current.push(chunk);
    bufferedBytesRef.current += chunk.bytes.byteLength;

    lastFormatRef.current = { sampleRate: chunk.sampleRate, channels: chunk.channels };

    const maxBytes = BUFFER_SECONDS * bytesPerSecond(chunk.sampleRate, chunk.channels);

    while (bufferedBytesRef.current > maxBytes && audioQueueRef.current.length > 0) {
      const dropped = audioQueueRef.current.shift();
      if (dropped) bufferedBytesRef.current -= dropped.bytes.byteLength;
    }

    updateBufferedSeconds(chunk.sampleRate, chunk.channels);
  };

  const playPCM16Bytes = (bytes: Uint8Array, sampleRate: number, channels: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Ensure aligned to Int16
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const frameCount = Math.floor(pcm16.length / channels);
    if (frameCount <= 0) return;

    const buffer = ctx.createBuffer(channels, frameCount, sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      let idx = ch;
      for (let i = 0; i < frameCount; i++, idx += channels) {
        data[i] = pcm16[idx] / 32768;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    if (playheadRef.current < ctx.currentTime) {
      playheadRef.current = ctx.currentTime;
    }

    src.start(playheadRef.current);
    playheadRef.current += buffer.duration;
  };

  const playPCM16 = (b64: string, sampleRate: number, channels: number) => {
    const bytes = base64ToUint8Array(b64);
    playPCM16Bytes(bytes, sampleRate, channels);
  };

  const flushBufferedAudio = () => {
    const queued = audioQueueRef.current;
    audioQueueRef.current = [];
    bufferedBytesRef.current = 0;
    lastFormatRef.current = null;
    setBufferedSeconds(0);

    for (const chunk of queued) {
      playPCM16Bytes(chunk.bytes, chunk.sampleRate, chunk.channels);
    }
  };

  const closeWs = () => {
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.onopen = null;
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
      } catch {}
      try {
        ws.close();
      } catch {}
    }
    wsRef.current = null;
  };

  const ensureAudioCtx = () => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = ctx;
    playheadRef.current = ctx.currentTime;
  };

  const closeAudioCtx = async () => {
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (!ctx) return;
    try {
      await ctx.close();
    } catch {}
  };

  const connectWs = (targetEngine: Engine, targetRate: RealtimeRate) => {
    ensureAudioCtx();

    const wsUrl = buildManualWsUrl(targetEngine, targetRate);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      push(
        targetEngine === "realtime"
          ? `Manual WS connected (engine=${targetEngine}, rate=${targetRate})`
          : `Manual WS connected (engine=${targetEngine})`
      );
      setConnectedEngine(targetEngine);
      setConnectedRate(targetEngine === "realtime" ? targetRate : "n/a");
    };

    ws.onclose = () => {
      push(`Manual WS closed (engine=${targetEngine})`);
      setConnectedEngine("unknown");
      setConnectedRate("unknown");
    };

    ws.onerror = () => {
      push(`Manual WS error (engine=${targetEngine})`);
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data !== "string") return;

      let msg: ServerMsg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (msg.type === "error") {
        push(`ERROR: ${msg.message}`);
        return;
      }

      if (msg.type === "engine") {
        const e = (msg.engine || "").toLowerCase();
        if (e === "tts" || e === "realtime") {
          setConnectedEngine(e);
          push(`Server engine confirmed: ${e}`);
        }
        return;
      }

      if (msg.type === "rate") {
        setConnectedRate(msg.rate ?? "unknown");
        push(`Server rate confirmed: ${msg.rate}`);
        return;
      }

      if (msg.type === "agent_done") {
        push("agent_done");
        return;
      }

      if (msg.type === "audio") {
        if (pausedRef.current) {
          // While paused, we buffer decoded PCM bytes (bounded ring buffer).
          const bytes = base64ToUint8Array(msg.data);
          enqueueAudio({ bytes, sampleRate: msg.sample_rate, channels: msg.channels });
          return;
        }

        playPCM16(msg.data, msg.sample_rate, msg.channels);
      }
    };
  };

  // Connect on mount, reconnect whenever engine OR realtimeRate changes
  useEffect(() => {
    localStorage.setItem("manual_engine", engine);
    localStorage.setItem("manual_realtime_rate", realtimeRate);

    // On engine/rate change, clear paused state and buffer to avoid cross-session mixing.
    setIsPaused(false);
    pausedRef.current = false;
    clearBufferedAudio();

    // If AudioContext was suspended, resume it so new connection plays normally.
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    closeWs();
    connectWs(engine, realtimeRate);

    return () => {
      closeWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, realtimeRate]);

  // Component unmount: close AudioContext
  useEffect(() => {
    return () => {
      void closeAudioCtx();
    };
  }, []);

  /* ---------------- LOAD SAVED INSTRUCTIONS (Option A) ---------------- */

  useEffect(() => {
    const local = loadLocalInstructions();
    if (local) {
      setInstructions(local);
      setInstructionsDirty(false);
      push("Loaded instructions from localStorage");
    }

    // Best-effort compatibility load (NOT source of truth).
    // Only use server value if localStorage is empty.
    fetch(LOAD_INSTR_URL)
      .then((r) => r.json())
      .then((data) => {
        const current = typeof data?.current === "string" ? data.current : "";
        if (!local && current.trim().length > 0) {
          setInstructions(current);
          setInstructionsDirty(false);
          saveLocalInstructions(current);
          push("Loaded instructions from backend (compatibility)");
        }
      })
      .catch(() => {
        // Ignore; localStorage is primary.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- LOAD SAVED ANSWERS (Option A) ---------------- */

  useEffect(() => {
    const local = loadLocalAnswers();
    if (local) {
      setAnswers(local);
      push("Loaded answers from localStorage");
    }

    // Best-effort compatibility load (NOT source of truth).
    // Only use server value if localStorage is empty.
    fetch(LOAD_ANSWERS_URL)
      .then((r) => r.json())
      .then((data) => {
        if (local) return;
        if (Array.isArray(data.answers)) {
          const src = data.answers.map((x: unknown) => (typeof x === "string" ? x : String(x ?? "")));
          const padded =
            src.length >= 10 ? src.slice(0, 10) : [...src, ...Array.from({ length: 10 - src.length }, () => "")];
          setAnswers(padded);
          saveLocalAnswers(padded);
          push("Loaded answers from backend (compatibility)");
        }
      })
      .catch(() => {
        // Ignore; localStorage is primary.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- SAVE INSTRUCTIONS (Option A) ---------------- */

  const saveInstructions = async () => {
    const text = instructions.trim();
    if (!text) {
      alert("Instructions are empty");
      return;
    }

    // Source of truth: localStorage
    saveLocalInstructions(text);

    // Best-effort compatibility save (do not block UX)
    try {
      await fetch(SAVE_INSTR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: text }),
      });
    } catch {
      // ignore
    }

    setInstructionsDirty(false);
    push("Saved instructions (localStorage; backend best-effort)");
  };

  /* ---------------- SEND ---------------- */

  const sendAnswer = async (index: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      push("WS not open");
      return;
    }

    // Ensure we persist instruction edits before sending (so backend uses the latest)
    if (instructionsDirty) {
      await saveInstructions();
      if (instructionsDirty) return;
    }

    const text = answers[index].trim();
    if (!text) {
      push(`My answer ${index + 1} empty`);
      return;
    }

    // Send text + instructions as separate fields (Option A).
    ws.send(JSON.stringify({ type: "SEND_TEXT", text, instructions }));
    push(
      engine === "realtime"
        ? `Sent My answer ${index + 1} (engine=${engine}, rate=${realtimeRate})`
        : `Sent My answer ${index + 1} (engine=${engine})`
    );
  };

  /* ---------------- SAVE ANSWER (Option A) ---------------- */

  const saveAnswer = async (index: number) => {
    const text = answers[index].trim();
    if (!text) {
      alert("Nothing to save");
      return;
    }

    // Source of truth: localStorage (save full list)
    const next = [...answers];
    next[index] = text;
    saveLocalAnswers(next);

    // Best-effort compatibility save
    try {
      await fetch(SAVE_ANSWERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, text }),
      });
    } catch {
      // ignore
    }

    push(`Saved My answer ${index + 1} (localStorage; backend best-effort)`);
  };

  /* ---------------- PAUSE / RESUME ---------------- */

  const togglePause = async () => {
    ensureAudioCtx();
    const ctx = audioCtxRef.current;

    if (!isPaused) {
      setIsPaused(true);
      pausedRef.current = true;

      // Pause immediately (best UX). Audio keeps arriving; we buffer up to 120s.
      if (ctx) {
        try {
          await ctx.suspend();
        } catch {
          // If suspend fails, we still behave as "paused" by buffering (no new scheduling).
        }
      }
      push(`Paused playback. Buffering up to ${BUFFER_SECONDS}s.`);
      return;
    }

    // Resume
    setIsPaused(false);
    pausedRef.current = false;

    if (ctx) {
      try {
        await ctx.resume();
      } catch {
        // Even if resume fails, we still attempt to flush; scheduling may work depending on browser state.
      }
    }

    const hadBuffered = audioQueueRef.current.length > 0;
    flushBufferedAudio();
    push(hadBuffered ? "Resumed playback. Flushed buffered audio." : "Resumed playback.");
  };

  /* ---------------- UI ---------------- */

  const bufferedLabel =
    lastFormatRef.current && bufferedBytesRef.current > 0
      ? `${Math.min(bufferedSeconds, BUFFER_SECONDS).toFixed(1)}s / ${BUFFER_SECONDS}s`
      : `0.0s / ${BUFFER_SECONDS}s`;

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Manual Voice (TEXT → VOICE)</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Engine:</label>
          <select value={engine} onChange={(e) => setEngine(e.target.value as Engine)}>
            <option value="tts">TTS</option>
            <option value="realtime">Realtime</option>
          </select>
          <span style={{ opacity: 0.7 }}>connected: {connectedEngine}</span>
        </div>

        {/* Realtime rate dropdown (only relevant when engine=realtime) */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Realtime rate:</label>
          <select
            value={realtimeRate}
            onChange={(e) => setRealtimeRate(e.target.value as RealtimeRate)}
            disabled={engine !== "realtime"}
            title={engine !== "realtime" ? "Rate applies only to Realtime engine" : ""}
          >
            <option value="1">1</option>
            <option value="0.9">0.9</option>
            <option value="0.8">0.8</option>
          </select>
          <span style={{ opacity: 0.7 }}>server: {connectedRate}</span>
        </div>

        {/* Pause/Resume */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => void togglePause()}>{isPaused ? "Resume" : "Pause"}</button>
          <span style={{ opacity: 0.7 }}>{isPaused ? `paused (buffer ${bufferedLabel})` : "playing"}</span>
        </div>

        <button
          onClick={() => window.open(import.meta.env.VITE_VOICECHAT_URL, "VoiceFrontend", "noopener,noreferrer")}
          style={{ marginLeft: 8 }}
        >
          Open VoiceChat
        </button>

        <button onClick={onBack}>Back</button>
      </div>

      <h3>Active Instructions (editable)</h3>
      <textarea
        rows={8}
        style={{ width: "100%" }}
        value={instructions}
        onChange={(e) => {
          setInstructions(e.target.value);
          setInstructionsDirty(true);
        }}
      />
      <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => void saveInstructions()} disabled={!instructionsDirty}>
          Save Instructions
        </button>
        <span style={{ opacity: 0.7 }}>{instructionsDirty ? "Unsaved" : "Saved"}</span>
      </div>

      <h3>My Answers (10)</h3>

      {answers.map((val, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>My answer {i + 1}</div>
          <textarea
            rows={3}
            style={{ width: "100%" }}
            value={val}
            onChange={(e) => {
              const copy = [...answers];
              copy[i] = e.target.value;
              setAnswers(copy);
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => void sendAnswer(i)}>Send</button>
            <button onClick={() => void saveAnswer(i)}>Save</button>
          </div>
        </div>
      ))}

      <pre>{log.join("\n")}</pre>
    </div>
  );
}
