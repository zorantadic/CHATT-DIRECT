import { useEffect, useRef, useState } from "react";

const MANUAL_HTTP = import.meta.env.VITE_MANUAL_HTTP;
const MANUAL_WS = MANUAL_HTTP.replace("https://", "wss://") + "/manual/ws";
const SAVE_URL = MANUAL_HTTP + "/manual/answers";
const LOAD_URL = MANUAL_HTTP + "/manual/answers";


type ServerMsg =
  | { type: "audio"; data: string; sample_rate: number; channels: number }
  | { type: "agent_done" }
  | { type: "error"; message: string };

type ManualVoiceChatProps = {
  onBack: () => void;
};

export default function ManualVoiceChat({ onBack }: ManualVoiceChatProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef<number>(0);

  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l, m]);

  const [instructions, setInstructions] = useState(
`Read the provided text exactly as written.

Do not add, remove, rephrase, or summarize anything.
Do not explain, comment, or interpret the text.
Do not ask questions.
Do not greet or acknowledge the user.

Use a calm, neutral voice.
Speak clearly and at a slow, steady pace.
Maintain consistent pronunciation and rhythm.

After finishing the text, stop speaking and wait silently.`
  );

  const [answers, setAnswers] = useState<string[]>(
    Array.from({ length: 7 }, () => "")
  );

  /* ---------------- LIFECYCLE ---------------- */

  useEffect(() => {
    const ws = new WebSocket(MANUAL_WS);
    wsRef.current = ws;

    const ctx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = ctx;
    playheadRef.current = ctx.currentTime;

    ws.onopen = () => push("Manual WS connected");
    ws.onclose = () => push("Manual WS closed");

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

      if (msg.type === "agent_done") {
        push("agent_done");
        return;
      }

      if (msg.type === "audio") {
        playPCM16(msg.data, msg.sample_rate, msg.channels);
      }
    };

    return () => {
      ws.close();
      ctx.close();
    };
  }, []);

  /* ---------------- LOAD SAVED ANSWERS ---------------- */

  useEffect(() => {
    fetch(LOAD_URL)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.answers) && data.answers.length === 7) {
          setAnswers(data.answers);
          push("Loaded saved answers");
        }
      })
      .catch(() => {
        push("Failed to load saved answers");
      });
  }, []);

  /* ---------------- AUDIO ---------------- */

  const playPCM16 = (b64: string, sampleRate: number, channels: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm16 = new Int16Array(bytes.buffer);
    const frameCount = pcm16.length / channels;

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

  /* ---------------- SEND ---------------- */

  const sendAnswer = (index: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      push("WS not open");
      return;
    }

    const text = answers[index].trim();
    if (!text) {
      push(`My answer ${index + 1} empty`);
      return;
    }

    const finalText = `${instructions}\n\n---\nMY ANSWER:\n${text}`;
    ws.send(JSON.stringify({ type: "SEND_TEXT", text: finalText }));
    push(`Sent My answer ${index + 1}`);
  };

  /* ---------------- SAVE ---------------- */

  const saveAnswer = async (index: number) => {
    const text = answers[index].trim();
    if (!text) {
      alert("Nothing to save");
      return;
    }

    try {
      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: index,
          text: text,
        }),
      });

      if (!res.ok) {
        alert("Save failed");
        return;
      }

      push(`Saved My answer ${index + 1}`);
    } catch {
      alert("Save error");
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Manual Voice (TEXT → VOICE)</h2>
        <button
          onClick={() =>
            window.open("http://localhost:3000/", "VoiceFrontend", "noopener,noreferrer")
          }
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
        onChange={(e) => setInstructions(e.target.value)}
      />

      <h3>My Answers</h3>

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
            <button onClick={() => sendAnswer(i)}>Send</button>
            <button onClick={() => saveAnswer(i)}>Save</button>
          </div>
        </div>
      ))}

      <pre>{log.join("\n")}</pre>
    </div>
  );
}
