import { useRef, useState } from "react";

type SttMsg =
  | {
      type: "STT_FINAL";
      sessionId: string;
      transcript: string;
      confidence?: number | null;
    }
  | { type: "STT_ERROR"; sessionId: string; error: string };

type HistoryItem = {
  id: string;
  at: string;
  transcript: string;
  confidence?: number | null;

  agentJson?: string; // pretty JSON string
  questions?: string[];
  error?: string;
};

export default function SpeechToAgentTest() {
  const [running, setRunning] = useState(false);

  // Current (latest) view
  const [sttText, setSttText] = useState<string>("");
  const [agentJson, setAgentJson] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [log, setLog] = useState<string[]>([]);

  const sttWsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const sessionId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "test123"
  );

  // === STT BUFFERING (NEW) ===
  const sttBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const bufferConfidenceRef = useRef<number | null>(null);

  const push = (m: string) => setLog((l) => [...l, m]);

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  /* ============================
     SMART FLUSH HEURISTIC
     ============================ */

  const looksCompleteThought = (text: string): boolean => {
    const t = text.toLowerCase().trim();
    if (!t) return false;

    // Strong signal
    if (t.includes("?")) return true;

    // Interrogatives / intent markers (covers your enterprise questions)
    const markers = [
      "how would",
      "what would",
      "why would",
      "can you",
      "could you",
      "would you",
      "walk us through",
      "explain",
      "justify",
      "design",
      "prioritize",
      "considerations",
      "trade-offs",
      "tradeoffs",
      "strategy",
    ];

    if (markers.some((k) => t.includes(k))) return true;

    // Fallback: long enough and ends as a sentence
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 12 && (t.endsWith(".") || t.endsWith("!"))) return true;

    return false;
  };

  /* ============================
     FLUSH STT BUFFER → AGENT1
     ============================ */

  const flushSttBuffer = async () => {
    if (sttBufferRef.current.length === 0) return;

    const fullText = sttBufferRef.current.join(" ").trim();
    const confidence = bufferConfidenceRef.current ?? null;

    sttBufferRef.current = [];
    bufferConfidenceRef.current = null;

    const id = newId();
    const at = new Date().toLocaleTimeString();

    setSttText(fullText);
    push(`STT_BUFFER_FLUSH: ${fullText}`);

    // Create history record
    setHistory((h) => [
      ...h,
      {
        id,
        at,
        transcript: fullText,
        confidence,
      },
    ]);

    try {
      const res = await fetch("http://127.0.0.1:50506/v1/agent1/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullText }),
      });

      const raw = await res.text();

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        setAgentJson(raw);
        setQuestions([]);
        setHistory((h) =>
          h.map((it) =>
            it.id === id
              ? { ...it, agentJson: raw, questions: [], error: `HTTP ${res.status}` }
              : it
          )
        );
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        setAgentJson(raw);
        setQuestions([]);
        setHistory((h) =>
          h.map((it) =>
            it.id === id
              ? {
                  ...it,
                  agentJson: raw,
                  questions: [],
                  error: "Agent1 non-JSON output",
                }
              : it
          )
        );
        return;
      }

      const pretty = JSON.stringify(parsed, null, 2);
      const qs: string[] = Array.isArray(parsed.questions)
        ? parsed.questions.filter((q: any) => typeof q === "string")
        : [];

      setAgentJson(pretty);
      setQuestions(qs);

      setHistory((h) =>
        h.map((it) =>
          it.id === id
            ? { ...it, agentJson: pretty, questions: qs, error: undefined }
            : it
        )
      );
    } catch {
      push("Agent1 POST failed");
      setHistory((h) =>
        h.map((it) => (it.id === id ? { ...it, error: "Agent1 POST failed" } : it))
      );
    }
  };

  /* ============================
     START
     ============================ */

  const start = async () => {
    try {
      setSttText("");
      setAgentJson("");
      setQuestions([]);
      setHistory([]);
      setLog([]);

      sttBufferRef.current = [];
      bufferConfidenceRef.current = null;
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      push(`sessionId=${sessionId.current}`);

      mediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      // STT WS
      sttWsRef.current = new WebSocket(
        `ws://127.0.0.1:50507/stt/ws/${sessionId.current}`
      );
      sttWsRef.current.binaryType = "arraybuffer";

      sttWsRef.current.onopen = () => push("STT WS otvoren");

      sttWsRef.current.onmessage = async (evt) => {
        if (typeof evt.data !== "string") return;

        let msg: SttMsg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (msg.type === "STT_FINAL") {
          push(`STT_FINAL (chunk): ${msg.transcript}`);

          // === SMART BUFFERING LOGIC ===
          sttBufferRef.current.push(msg.transcript);

          // track "worst" confidence across chunks (conservative)
          if (typeof msg.confidence === "number") {
            bufferConfidenceRef.current =
              bufferConfidenceRef.current == null
                ? msg.confidence
                : Math.min(bufferConfidenceRef.current, msg.confidence);
          }

          if (flushTimerRef.current) {
            window.clearTimeout(flushTimerRef.current);
          }

          const combined = sttBufferRef.current.join(" ").trim();

          flushTimerRef.current = window.setTimeout(() => {
            // Flush only if the buffer looks like a complete thought.
            // Otherwise keep buffering until next chunk arrives.
            if (looksCompleteThought(combined)) {
              flushSttBuffer();
            } else {
              push("STT_BUFFER_WAIT (incomplete thought)");
            }
            flushTimerRef.current = null;
          }, 1600);
        }

        if (msg.type === "STT_ERROR") {
          push(`STT_ERROR: ${msg.error}`);
        }
      };

      sttWsRef.current.onclose = () => push("STT WS zatvoren");

      // AudioContext for STT only (48k → worklet → 16k on server)
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const src = ctx.createMediaStreamSource(mediaRef.current);
      await ctx.audioWorklet.addModule("/stt-worklet-processor.js");
      const node = new AudioWorkletNode(ctx, "stt-pcm16-16k");

      node.port.onmessage = (e) => {
        if (sttWsRef.current?.readyState === WebSocket.OPEN) {
          sttWsRef.current.send(e.data);
        }
      };

      src.connect(node);

      setRunning(true);
    } catch (e) {
      console.error(e);
      push("Start error");
    }
  };

  /* ============================
     STOP
     ============================ */

  const stop = () => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    sttBufferRef.current = [];
    bufferConfidenceRef.current = null;

    sttWsRef.current?.close();
    sttWsRef.current = null;

    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;

    ctxRef.current?.close();
    ctxRef.current = null;

    setRunning(false);
    push("Zaustavljeno");
  };

  /* ============================
     UI
     ============================ */

  return (
    <div style={{ padding: 16 }}>
      <h2>Speech → Agent1 Test</h2>

      <button onClick={running ? stop : start}>{running ? "Stop" : "Start"}</button>
      <button
        onClick={() => {
          setHistory([]);
          push("History cleared");
        }}
        style={{ marginLeft: 8 }}
        disabled={running}
        title={running ? "Stop first to clear history" : "Clear history"}
      >
        Clear history
      </button>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <h4>STT FINAL (buffered)</h4>
          <pre style={{ background: "#f4f4f4", padding: 8 }}>
            {sttText || "(nema)"}
          </pre>
        </div>

        <div style={{ flex: 1 }}>
          <h4>Agent1 Output</h4>
          <pre style={{ background: "#f4f4f4", padding: 8 }}>
            {agentJson || "(nema)"}
          </pre>

          {questions.length > 0 && (
            <>
              <h4>Prepoznata pitanja</h4>
              <ul>
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>History</h3>

        {history.length === 0 ? (
          <div style={{ opacity: 0.7 }}>(nema)</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {history.map((it, idx) => (
              <div
                key={it.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: 10,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  #{idx + 1} • {it.at}
                  {typeof it.confidence === "number"
                    ? ` • conf=${it.confidence}`
                    : ""}
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>STT:</b> {it.transcript}
                </div>

                <div style={{ marginTop: 8 }}>
                  <b>Agent1:</b>{" "}
                  {it.error ? (
                    <span style={{ color: "crimson" }}>{it.error}</span>
                  ) : it.agentJson ? (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {it.agentJson}
                    </pre>
                  ) : (
                    <span>(pending)</span>
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <b>Questions:</b>
                  {it.questions && it.questions.length > 0 ? (
                    <ul style={{ margin: "6px 0 0 18px" }}>
                      {it.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ opacity: 0.7 }}>(none)</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Log</h4>
        <pre style={{ background: "#eee", padding: 8 }}>{log.join("\n")}</pre>
      </div>
    </div>
  );
}
