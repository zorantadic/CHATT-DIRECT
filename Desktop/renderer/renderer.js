/* global electronAPI */
(function () {
  const DEFAULTS = {
    STT_WS_BASE: "wss://chatt-speech.ashyglacier-62457361.eastus2.azurecontainerapps.io/stt/ws",
    ORCH_HTTP: "https://chatt-orchestrator.ashyglacier-62457361.eastus2.azurecontainerapps.io",
    ORCH_CONTROL_WS_BASE: "wss://chatt-orchestrator.ashyglacier-62457361.eastus2.azurecontainerapps.io/v1/control",
    REALTIME_HTTP: "https://chatt-realtime.ashyglacier-62457361.eastus2.azurecontainerapps.io",
    REALTIME_WS: "wss://chatt-realtime.ashyglacier-62457361.eastus2.azurecontainerapps.io/voice/ws",
  };
  const LOCAL_BACKEND_PRESET = {
    STT_WS_BASE: "ws://127.0.0.1:50507/stt/ws",
    ORCH_HTTP: "http://127.0.0.1:50506",
    ORCH_CONTROL_WS_BASE: "ws://127.0.0.1:50506/v1/control",
    REALTIME_HTTP: "http://127.0.0.1:50505",
    REALTIME_WS: "ws://127.0.0.1:50505/voice/ws",
  };
  const FULL_PIPELINE_TEST_AUDIO_URL = "../assets/test-audio/full-pipeline-test.wav";
  const FULL_PIPELINE_TEST_INSTRUCTIONS =
`This is a CHATT full pipeline system test.
Respond with exactly this sentence and nothing else:
Full pipeline test successful.`;
  // Persisted settings
  const LS_RT_DEVICE_ID = "chatt.rtOutputDeviceId";
  const LS_RT_DEVICE_LABEL = "chatt.rtOutputDeviceLabel";
  const LS_RT_DEVICE_PREFERRED_LABEL = "chatt.rtPreferredDeviceLabel";
  // STT production settings
  const LS_STT_ENABLED = "chatt.sttEnabled";
  const LS_STT_LANGUAGE = "chatt.sttLanguage";
  // Endpoints (settings page)
  const LS_STT_BASE = "chatt.settings.sttBase";
  const LS_ORCH_HTTP = "chatt.settings.orchHttp";
  const LS_CONTROL_BASE = "chatt.settings.controlBase";
  const LS_RT_HTTP = "chatt.settings.rtHttp";
  const LS_RT_WS = "chatt.settings.rtWs";
  // Auth (optional)
  const LS_AUTH_TOKEN = "chatt.auth.bearerToken";
  const SUPPORTED_LANGS = ["en-US", "sr-RS", "es-ES", "de-DE", "hr-HR"];
  const DEFAULT_LANG = "en-US";
// Voice output settings (Paket 1)
const LS_VOICE_ENGINE = "chatt.voice.engine";       // "realtime" | "tts"
const LS_REALTIME_RATE = "chatt.realtime.rate";
const LS_PLAYBACK_VOLUME = "chatt.realtime.playbackVolume";
const LS_INSTR_TARGET = "chatt.instructions.target"; // Direct Instructions target; always "realtime"
const LS_INSTRUCTION_PRESET = "chatt.instructions.preset";
const ALLOWED_VOICE_ENGINES = ["realtime", "tts"];
const DEFAULT_VOICE_ENGINE = "realtime";
const ALLOWED_REALTIME_RATES = ["1", "0.9", "0.8"];
const DEFAULT_REALTIME_RATE = "1";
  // HARD REQUIREMENT: Realtime audio must go to headphones only.
  const REALTIME_HEADPHONES_ONLY = true;
  const FIXED_RULES =
`RULES:
Answer only the provided question.
Do not ask questions.
Do not introduce new topics.`;
  const $ = (id) => document.getElementById(id);
  // ------------------------------
  // Logging
  // ------------------------------
  const logEl = $("log");
  const logFilterEl = $("logFilter");
  const logAutoscrollEl = $("logAutoscroll");
  const btnLogCopy = $("btnLogCopy");
  const btnLogClear = $("btnLogClear");
  const btnLogDownload = $("btnLogDownload");
  const logLines = [];
  let logFilter = "";
  let logAutoscroll = true;
  function renderLog() {
    if (!logEl) return;
    const f = (logFilter || "").toLowerCase();
    const visible = f ? logLines.filter((ln) => ln.toLowerCase().includes(f)) : logLines;
    logEl.textContent = visible.join("\n") + (visible.length ? "\n" : "");
    if (logAutoscroll) logEl.scrollTop = logEl.scrollHeight;
  }
  function push(m) {
    const ts = new Date().toISOString();
    const line = `${ts}  ${m}`;
    logLines.push(line);
    if (logLines.length > 5000) logLines.shift();
    if (!logEl) return;
    const f = (logFilter || "").toLowerCase();
    if (!f) {
      // Fast path: append
      logEl.textContent += line + "\n";
      if (logAutoscroll) logEl.scrollTop = logEl.scrollHeight;
      return;
    }
    // Filtered view: re-render
    renderLog();
  }
  function setPill(id, state, text) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("ok", "warn", "bad");
    el.classList.add(state);
    el.textContent = text;
  }
  // ------------------------------
  // Navigation (Views)
  // ------------------------------
  const viewVoice = $("viewVoice");
  const viewSettings = $("viewSettings");
  const viewInstructions = $("viewInstructions");
  const navVoice = $("navVoice");
  const navSettings = $("navSettings");
  const navInstructions = $("navInstructions");
  // Voice view: instructions preview panel
  const voiceInstrTextEl = $("voiceInstrText");
  const voiceInstrUpdatedAtEl = $("voiceInstrUpdatedAt");
  const btnVoiceCopyInstr = $("btnVoiceCopyInstr");
  const btnVoiceOpenInstr = $("btnVoiceOpenInstr");
  function setActiveNav(btn) {
    for (const b of [navVoice, navSettings, navInstructions]) {
      if (!b) continue;
      b.classList.toggle("active", b === btn);
    }
  }
  function setActiveView(name) {
    if (viewVoice) viewVoice.classList.toggle("active", name === "voice");
    if (viewSettings) viewSettings.classList.toggle("active", name === "settings");
    if (viewInstructions) viewInstructions.classList.toggle("active", name === "instructions");
    if (name === "voice") { setActiveNav(navVoice); updateVoiceInstructionsUI(); }
    if (name === "settings") setActiveNav(navSettings);
    if (name === "instructions") setActiveNav(navInstructions);
    if (name === "instructions") {
      // Lazy-load profiles + refresh instructions UI when user opens the page.
      try { refreshInstructionsPage().catch(() => {}); } catch {}
    }
  }
  if (navVoice) navVoice.addEventListener("click", () => setActiveView("voice"));
  if (btnVoiceOpenInstr) btnVoiceOpenInstr.addEventListener("click", () => setActiveView("instructions"));
  if (btnVoiceCopyInstr) btnVoiceCopyInstr.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getEffectiveInstructionsForEngine().toString());
      push("Instructions copied to clipboard");
    } catch {
      push("WARN: copy failed (clipboard permission)");
    }
  });
  if (navSettings) navSettings.addEventListener("click", () => setActiveView("settings"));
  if (navInstructions) navInstructions.addEventListener("click", () => setActiveView("instructions"));
  // ------------------------------
  // SessionId (mutable for Reset)
  // ------------------------------
  let sid =
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : ("test-" + Math.random().toString(16).slice(2));
  $("sid").textContent = sid;
  // ------------------------------
  // Settings helpers
  // ------------------------------
  function loadBoolLS(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null || v === undefined) return fallback;
      return v === "true";
    } catch {
      return fallback;
    }
  }
  function saveBoolLS(key, val) {
    try { localStorage.setItem(key, val ? "true" : "false"); } catch {}
  }
  function loadStrLS(key, fallback) {
    try {
      const v = (localStorage.getItem(key) || "").trim();
      return v ? v : fallback;
    } catch {
      return fallback;
    }
  }
  function saveStrLS(key, val) {
    try {
      if (val) localStorage.setItem(key, val);
      else localStorage.removeItem(key);
    } catch {}
  }
  function normalizeLang(lang) {
    if (!lang) return DEFAULT_LANG;
    if (SUPPORTED_LANGS.includes(lang)) return lang;
    return DEFAULT_LANG;
  }
  function getAuthToken() {
    try { return (localStorage.getItem(LS_AUTH_TOKEN) || "").trim(); } catch { return ""; }
  }
  function authHeaders(extra) {
    const h = Object.assign({}, extra || {});
    const token = getAuthToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }
  // ------------------------------
  // DOM refs
  // ------------------------------
  const loopMonitor = $("loopMonitor");
  const rtOutEl = $("rtOut");
  const rtDeviceSel = $("rtDevice");
  const sttEnabledEl = $("sttEnabled");
  const sttLangEl = $("sttLang");
  const voiceEngineEl = $("voiceEngine");
  const voiceEngineVoiceEl = $("voiceEngineVoice");
  const realtimeRateEl = $("realtimeRate");
  const realtimeRateVoiceEl = $("realtimeRateVoice");
  const playbackVolumeEl = $("playbackVolume");
  const playbackVolumeValueEl = $("playbackVolumeValue");
  const btnResetSession = $("btnResetSession");
  const btnTestFullPipeline = $("btnTestFullPipeline");
  // Pause/Resume (Voice audio) UI refs (created dynamically)
  let btnPauseAudio = null;
  let pauseInfoEl = null;
  // Settings page elements
  const btnUseLocalBackend = $("btnUseLocalBackend");
  const btnSaveSettings = $("btnSaveSettings");
  const btnResetSettings = $("btnResetSettings");
  const settingsSaved = $("settingsSaved");
  const authTokenEl = $("authToken");
  const btnSaveToken = $("btnSaveToken");
  const btnClearToken = $("btnClearToken");
  const authStatusEl = $("authStatus");
  // Instructions page elements
  const instrBackendEl = $("instrBackend");
  const instrCurrentEl = $("instrCurrent");
  const instrDefaultEl = $("instrDefault");
  const instrUpdatedAtEl = $("instrUpdatedAt");
  const instrStatusEl = $("instrStatus");
  const instructionPresetEl = $("instructionPreset");
  const btnInstrLoad = $("btnInstrLoad");
  const btnInstrSave = $("btnInstrSave");
  const btnInstrReset = $("btnInstrReset");
  const btnInstrRefresh = $("btnInstrRefresh");
  const instrTargetEl = $("instrTarget");
  const profilesErrorEl = $("profilesError");
  const profilesStylesEl = $("profilesStyles");
  const profilesDomainsEl = $("profilesDomains");
  let profilesCache = null; // {version, styles, domains} loaded (local first, backend fallback)

  // Playback pipeline (Realtime) routed to rtOutEl via MediaStreamDestination
  let playbackCtx = null;
  let playhead = 0;
  let playbackDest = null;
  let playbackVolume = 1.0;
  let playbackGainNode = null;
  const activePlaybackSources = new Set();
  let isAssistantSpeaking = false;

  // ------------------------------
  // Initialize settings into inputs
  // ------------------------------
  function loadEndpointSettingsIntoInputs() {
    $("sttBase").value = loadStrLS(LS_STT_BASE, DEFAULTS.STT_WS_BASE);
    $("orchHttp").value = loadStrLS(LS_ORCH_HTTP, DEFAULTS.ORCH_HTTP);
    $("controlBase").value = loadStrLS(LS_CONTROL_BASE, DEFAULTS.ORCH_CONTROL_WS_BASE);
    $("rtHttp").value = loadStrLS(LS_RT_HTTP, DEFAULTS.REALTIME_HTTP);
    $("rtWs").value = loadStrLS(LS_RT_WS, DEFAULTS.REALTIME_WS);
  }
  function loadSttSettingsIntoInputs() {
    const enabled = loadBoolLS(LS_STT_ENABLED, true);
    const lang = normalizeLang(loadStrLS(LS_STT_LANGUAGE, DEFAULT_LANG));
    if (sttEnabledEl) sttEnabledEl.checked = enabled;
    if (sttLangEl) sttLangEl.value = lang;
  }
function loadVoiceSettingsIntoInputs() {
  const engine = normalizeVoiceEngine(loadStrLS(LS_VOICE_ENGINE, DEFAULT_VOICE_ENGINE));
  const rate = normalizeRealtimeRate(loadStrLS(LS_REALTIME_RATE, DEFAULT_REALTIME_RATE));
  if (voiceEngineEl) voiceEngineEl.value = engine;
  if (voiceEngineVoiceEl) voiceEngineVoiceEl.value = engine;
  if (realtimeRateEl) realtimeRateEl.value = rate;
  if (realtimeRateVoiceEl) realtimeRateVoiceEl.value = rate;
  applyVoiceEngineUiState(engine);
}
function normalizePlaybackVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(2.0, Math.max(0.0, n));
}

function updatePlaybackVolumeUi() {
  if (playbackVolumeEl) playbackVolumeEl.value = String(playbackVolume);
  if (playbackVolumeValueEl) playbackVolumeValueEl.textContent = playbackVolume.toFixed(2);
}

function applyPlaybackVolume(value) {
  playbackVolume = normalizePlaybackVolume(value);
  saveStrLS(LS_PLAYBACK_VOLUME, String(playbackVolume));
  updatePlaybackVolumeUi();

  if (playbackGainNode) {
    playbackGainNode.gain.value = playbackVolume;
  }
}
function loadInstructionsTargetIntoInputs() {
  const target = "realtime";
  if (instrTargetEl) instrTargetEl.value = target;
  saveStrLS(LS_INSTR_TARGET, target);
}

  function initAuthUi() {
    const token = getAuthToken();
    if (authTokenEl) authTokenEl.value = token ? token : "";
    if (authStatusEl) authStatusEl.textContent = token ? "Token set" : "No token";
  }
  loadEndpointSettingsIntoInputs();
  loadSttSettingsIntoInputs();
  initAuthUi();
  loadVoiceSettingsIntoInputs();
  applyPlaybackVolume(loadStrLS(LS_PLAYBACK_VOLUME, "1"));
  loadInstructionsTargetIntoInputs();
  // ------------------------------
  // STT settings
  // ------------------------------
  function getSttEnabled() {
    return !!sttEnabledEl?.checked;
  }
  function getSttLanguage() {
    return normalizeLang(sttLangEl?.value || DEFAULT_LANG);
  }
  function buildSttWsUrl(base, sessionId, lang) {
    const b = (base || "").replace(/\/+$/, "");
    const l = encodeURIComponent(lang || DEFAULT_LANG);
    // NOTE: server currently uses `language=`. We also include `lang` and `locale` for broader compatibility.
    return `${b}/${sessionId}?language=${l}&lang=${l}&locale=${l}&mode=fixed`;
  }

// ------------------------------
// Voice output settings (engine + rate)
// ------------------------------
function normalizeVoiceEngine(engine) {
  const e = (engine || "").toString().trim().toLowerCase();
  return ALLOWED_VOICE_ENGINES.includes(e) ? e : DEFAULT_VOICE_ENGINE;
}
function normalizeRealtimeRate(rate) {
  const r = (rate || "").toString().trim();
  return ALLOWED_REALTIME_RATES.includes(r) ? r : DEFAULT_REALTIME_RATE;
}
function getVoiceEngine() {
  // Prefer Voice tab selector; fallback to Settings selector; then persisted; then default.
  const uiVoice = (voiceEngineVoiceEl?.value || "").toString().trim();
  const uiSettings = (voiceEngineEl?.value || "").toString().trim();
  return normalizeVoiceEngine(uiVoice || uiSettings || loadStrLS(LS_VOICE_ENGINE, DEFAULT_VOICE_ENGINE));
}
function getRealtimeRate() {
  const uiVoice = (realtimeRateVoiceEl?.value || "").toString().trim();
  const uiSettings = (realtimeRateEl?.value || "").toString().trim();
  return normalizeRealtimeRate(uiVoice || uiSettings || loadStrLS(LS_REALTIME_RATE, DEFAULT_REALTIME_RATE));
}
function applyVoiceEngineUiState(engine) {
  const e = normalizeVoiceEngine(engine);
  const enabled = e === "realtime";
  if (realtimeRateEl) {
    realtimeRateEl.disabled = !enabled;
    realtimeRateEl.title = enabled ? "" : "Rate applies only when Voice Engine = realtime";
  }
  if (realtimeRateVoiceEl) {
    realtimeRateVoiceEl.disabled = !enabled;
    realtimeRateVoiceEl.title = enabled ? "" : "Rate applies only when Voice Engine = realtime";
  }
}
function buildVoiceWsUrl(baseWsUrl, engine, rate) {
  const base = (baseWsUrl || "").toString().trim().replace(/\/+$/, "");
  const e = normalizeVoiceEngine(engine);
  const r = normalizeRealtimeRate(rate);
  try {
    const u = new URL(base);
    u.searchParams.set("engine", e);
    if (e === "realtime") u.searchParams.set("rate", r);
    else u.searchParams.delete("rate");
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    let out = `${base}${sep}engine=${encodeURIComponent(e)}`;
    if (e === "realtime") out += `&rate=${encodeURIComponent(r)}`;
    return out;
  }
}

  // ------------------------------
  // Config builder (uses current sid)
  // ------------------------------
const cfg = () => {
  const base = $("sttBase").value;
  const lang = getSttLanguage();
  const engine = getVoiceEngine();
  const rate = getRealtimeRate();
  const rtWsBase = $("rtWs").value.replace(/\/+$/, "");
  return {
    STT_WS: buildSttWsUrl(base, sid, lang),
    ORCH_HTTP: $("orchHttp").value.replace(/\/+$/, ""),
    ORCH_CONTROL_WS: `${$("controlBase").value.replace(/\/+$/, "")}/${sid}`,
    REALTIME_HTTP: $("rtHttp").value.replace(/\/+$/, ""),
    REALTIME_WS: rtWsBase,
    VOICE_ENGINE: engine,
    REALTIME_RATE: rate,
    VOICE_WS: buildVoiceWsUrl(rtWsBase, engine, rate),
  };
};
  // ------------------------------
  // Desired connection state + reconnect (Control/Realtime)
  // ------------------------------
  let desiredConnected = false;
  let controlWs = null;
  let rtWs = null;
  let rtWsEngine = "";
  let controlReconnectAttempt = 0;
  let rtReconnectAttempt = 0;
  let controlReconnectTimer = null;
  let rtReconnectTimer = null;
  let rtReconnectSuppressOnce = false; // used for deliberate voice WS reconfigure
  // Keepalive ping timers
  let controlPingTimer = null;
  let rtPingTimer = null;
  function clearPingTimers() {
    try { if (controlPingTimer) window.clearInterval(controlPingTimer); } catch {}
    try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
    controlPingTimer = null;
    rtPingTimer = null;
  }
  function startControlPing() {
    try { if (controlPingTimer) window.clearInterval(controlPingTimer); } catch {}
    controlPingTimer = window.setInterval(() => {
      if (controlWs && controlWs.readyState === WebSocket.OPEN) {
        try { controlWs.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, WS_PING_INTERVAL_MS);
  }
  function startRealtimePing() {
    try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
    rtPingTimer = window.setInterval(() => {
      if (rtWs && rtWs.readyState === WebSocket.OPEN) {
        try { rtWs.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, WS_PING_INTERVAL_MS);
  }
  function clearReconnectTimers() {
    try { if (controlReconnectTimer) window.clearTimeout(controlReconnectTimer); } catch {}
    try { if (rtReconnectTimer) window.clearTimeout(rtReconnectTimer); } catch {}
    controlReconnectTimer = null;
    rtReconnectTimer = null;
  }
  const WS_PING_INTERVAL_MS = 30000; // 30s keepalive ping
  const WS_MAX_BACKOFF_MS = 30000;   // strict max 30s
  function backoffMs(attempt) {
    const base = Math.min(WS_MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.max(0, attempt)));
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(WS_MAX_BACKOFF_MS, base + jitter);
  }
  function setControlStatus(state) {
    if (state === "ON") setPill("controlStatus", "ok", "CONTROL: ON");
    else if (state === "RECONNECTING") setPill("controlStatus", "warn", "CONTROL: RECONNECTING");
    else setPill("controlStatus", "bad", "CONTROL: OFF");
  }
  function setRealtimeStatus(state) {
    const label = (getVoiceEngine() === "tts") ? "TTS" : "REALTIME";
    if (state === "ON") setPill("rtStatus", "ok", `${label}: ON`);
    else if (state === "RECONNECTING") setPill("rtStatus", "warn", `${label}: RECONNECTING`);
    else setPill("rtStatus", "bad", `${label}: OFF`);
  }
  function scheduleControlReconnect(reason) {
    if (!desiredConnected) return;
    if (controlReconnectTimer) return;
    setControlStatus("RECONNECTING");
    const delay = backoffMs(controlReconnectAttempt++);
    push(`Control WS reconnect scheduled in ${delay}ms (${reason || "closed"})`);
    controlReconnectTimer = window.setTimeout(() => {
      controlReconnectTimer = null;
      connectControl();
    }, delay);
  }
  function scheduleRealtimeReconnect(reason) {
    if (!desiredConnected) return;
    if (rtReconnectTimer) return;
    setRealtimeStatus("RECONNECTING");
    const delay = backoffMs(rtReconnectAttempt++);
    push(`Realtime WS reconnect scheduled in ${delay}ms (${reason || "closed"})`);
    rtReconnectTimer = window.setTimeout(() => {
      rtReconnectTimer = null;
      connectRealtime().catch(() => {});
    }, delay);
  }
// ------------------------------
// Instructions (Direct Realtime only)
// Local-first: Desktop (local JSON via Electron IPC) is the source of truth.
// Backend sync is best-effort and always targets realtime instructions.
// ------------------------------
const INSTR_TARGETS = ["realtime"];

const neutral_conversation =
`ROLE:
Direct realtime voice assistant in a live audio conversation.
Role mode: Neutral Conversation.

PRIMARY TASK:
Listen to incoming system/browser audio.
Track conversation context internally.
Identify the latest meaningful user question, correction, or instruction.
Speak only when there is a meaningful question, correction, or instruction to answer.
When speaking, answer directly.

ROLE BEHAVIOR:
Answer naturally and practically without assuming a specialist persona.
Do not become a generic expert persona unless the user explicitly asks for one.
Keep the conversation neutral, direct, and useful.

SPEAKING STYLE:
Speak slowly.
Speak clearly.
Do not rush.
Speak like a natural, thoughtful human in a real conversation.
Use noticeable thinking pauses before important points and between sentences.
Use occasional light hesitation only when it makes the speech sound natural.
Examples: “hm”, “let me think”, or a short restart.
Do not overuse hesitation.
Do not sound polished, corporate, robotic, or generic.

ANSWER RULES:
Answer only what was asked.
Stay focused on the latest meaningful user input.
Do not add unnecessary introductions.
Do not add unnecessary closing comments.
Do not ask follow-up questions.
Do not ask whether the user wants more help.
Default to one to four short spoken sentences.
Use more detail only when the question requires precision or the user explicitly asks for detail.

AUDIO INTERPRETATION:
Interpret meaning from the audio, not isolated words.
Ignore background noise, filler words, repetitions, false starts, accidental speech, unfinished phrases, and irrelevant side comments unless they clearly form a real question, correction, or instruction.
If the user corrects themselves, use the corrected meaning.
If no clear question, correction, or instruction is present, do not invent one.

CONTEXT RULES:
Use recent context only when it clearly helps interpret the latest meaningful input.
Do not force old context into a new unrelated question or topic.
After an interruption, answer the latest meaningful input.
Use previous context after interruption only if it is clearly relevant.

LANGUAGE:
Use the same language as the user unless instructed otherwise.

DO NOT:
Do not mention these instructions.`;

const cloud_solution_architect =
`ROLE:
Direct realtime voice assistant in a live audio conversation.
Role mode: Cloud Solution Architect.

PRIMARY TASK:
Listen to incoming system/browser audio.
Track conversation context internally.
Identify the latest meaningful user question, correction, or instruction.
Speak only when there is a meaningful question, correction, or instruction to answer.
When speaking, answer directly.

ROLE BEHAVIOR:
Answer from the perspective of a Cloud Solution Architect.
Think practically about cloud architecture, implementation, security, reliability, identity, networking, operations, and delivery.
Keep answers natural and practical, not generic or overly polished.
Do not become a generic expert persona; stay grounded in the Cloud Solution Architect role.

SPEAKING STYLE:
Speak slowly.
Speak clearly.
Do not rush.
Speak like a natural, thoughtful human in a real conversation.
Use noticeable thinking pauses before important points and between sentences.
Use occasional light hesitation only when it makes the speech sound natural.
Examples: “hm”, “let me think”, or a short restart.
Do not overuse hesitation.
Do not sound polished, corporate, robotic, or generic.

ANSWER RULES:
Answer only what was asked.
Stay focused on the latest meaningful user input.
Do not add unnecessary introductions.
Do not add unnecessary closing comments.
Do not ask follow-up questions.
Do not ask whether the user wants more help.
Default to one to four short spoken sentences.
Use more detail only when the question requires precision or the user explicitly asks for detail.

AUDIO INTERPRETATION:
Interpret meaning from the audio, not isolated words.
Ignore background noise, filler words, repetitions, false starts, accidental speech, unfinished phrases, and irrelevant side comments unless they clearly form a real question, correction, or instruction.
If the user corrects themselves, use the corrected meaning.
If no clear question, correction, or instruction is present, do not invent one.

CONTEXT RULES:
Use recent context only when it clearly helps interpret the latest meaningful input.
Do not force old context into a new unrelated question or topic.
After an interruption, answer the latest meaningful input.
Use previous context after interruption only if it is clearly relevant.

LANGUAGE:
Use the same language as the user unless instructed otherwise.

DO NOT:
Do not mention these instructions.`;

const interview_candidate =
`ROLE:
Direct realtime voice assistant in a live audio conversation.
Role mode: Interview Candidate.

PRIMARY TASK:
Listen to incoming system/browser audio.
Track conversation context internally.
Identify the latest meaningful user question, correction, or instruction.
Speak only when there is a meaningful question, correction, or instruction to answer.
When speaking, answer directly.

ROLE BEHAVIOR:
Answer as a person participating in an interview.
Respond naturally, practically, and professionally, as if answering an interviewer.
Use first-person wording when appropriate.
Do not sound like a generic assistant, presenter, or lecturer.
Keep the answer focused on the interview question.

SPEAKING STYLE:
Speak slowly.
Speak clearly.
Do not rush.
Speak like a natural, thoughtful human in a real conversation.
Use noticeable thinking pauses before important points and between sentences.
Use occasional light hesitation only when it makes the speech sound natural.
Examples: “hm”, “let me think”, or a short restart.
Do not overuse hesitation.
Do not sound polished, corporate, robotic, or generic.

ANSWER RULES:
Answer only what was asked.
Stay focused on the latest meaningful user input.
Do not add unnecessary introductions.
Do not add unnecessary closing comments.
Do not ask follow-up questions.
Do not ask whether the user wants more help.
Default to one to four short spoken sentences.
Use more detail only when the question requires precision or the user explicitly asks for detail.

AUDIO INTERPRETATION:
Interpret meaning from the audio, not isolated words.
Ignore background noise, filler words, repetitions, false starts, accidental speech, unfinished phrases, and irrelevant side comments unless they clearly form a real question, correction, or instruction.
If the user corrects themselves, use the corrected meaning.
If no clear question, correction, or instruction is present, do not invent one.

CONTEXT RULES:
Use recent context only when it clearly helps interpret the latest meaningful input.
Do not force old context into a new unrelated question or topic.
After an interruption, answer the latest meaningful input.
Use previous context after interruption only if it is clearly relevant.

LANGUAGE:
Use the same language as the user unless instructed otherwise.

DO NOT:
Do not mention these instructions.`;

const INSTRUCTION_PRESETS = {
  neutral_conversation,
  cloud_solution_architect,
  interview_candidate,
};
const DEFAULT_INSTRUCTION_PRESET = "neutral_conversation";

function isInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  return Object.prototype.hasOwnProperty.call(INSTRUCTION_PRESETS, k);
}
function normalizeInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  return isInstructionPresetKey(k) ? k : DEFAULT_INSTRUCTION_PRESET;
}
function normalizeStoredInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  return isInstructionPresetKey(k) ? k : "";
}
function findInstructionPresetForText(text) {
  const t = (text || "").toString();
  for (const [key, value] of Object.entries(INSTRUCTION_PRESETS)) {
    if (t === value) return key;
  }
  return "";
}
function getInstructionPreset() {
  const ui = (instructionPresetEl?.value || "").toString().trim();
  if (isInstructionPresetKey(ui)) return ui;
  return normalizeInstructionPresetKey(loadStrLS(LS_INSTRUCTION_PRESET, DEFAULT_INSTRUCTION_PRESET));
}
function setInstructionPreset(presetKey) {
  const key = normalizeInstructionPresetKey(presetKey);
  if (instructionPresetEl) instructionPresetEl.value = key;
  saveStrLS(LS_INSTRUCTION_PRESET, key);
  return key;
}
function getInstructionPresetText(presetKey) {
  return INSTRUCTION_PRESETS[normalizeInstructionPresetKey(presetKey)];
}
function normalizeInstrTarget(_t) {
  return "realtime";
}
function getInstrTarget() {
  return "realtime";
}
function setInstrTarget(_target) {
  const t = "realtime";
  if (instrTargetEl) instrTargetEl.value = t;
  saveStrLS(LS_INSTR_TARGET, t);
  return t;
}
function emptyInstrDoc() {
  return { current: "", default: "", updatedAt: "", source: "empty", preset: "" };
}
function normalizeInstrDoc(d) {
  return {
    current: (d?.current || "").toString(),
    default: (d?.default || "").toString(),
    updatedAt: (d?.updatedAt || "").toString(),
    source: (d?.source || "local").toString(),
    preset: normalizeStoredInstructionPresetKey(d?.preset || ""),
  };
}
function normalizeStore(raw) {
  // Accept legacy single-doc format and normalize into the Direct realtime-only store.
  if (!raw || typeof raw !== "object") {
    return { realtime: emptyInstrDoc() };
  }
  if (Object.prototype.hasOwnProperty.call(raw, "realtime")) {
    return { realtime: normalizeInstrDoc(raw.realtime) };
  }
  // Legacy: treat as realtime.
  return { realtime: normalizeInstrDoc(raw) };
}

let instructionStore = normalizeStore(null);

function hasLocalInstructionStore() {
  return !!(
    window.electronAPI &&
    typeof window.electronAPI.instructionsRead === "function" &&
    typeof window.electronAPI.instructionsWrite === "function"
  );
}

async function readLocalInstructionStore() {
  if (!hasLocalInstructionStore()) return null;
  try {
    const d = await window.electronAPI.instructionsRead();
    return normalizeStore(d);
  } catch {
    return null;
  }
}

async function writeLocalInstructionStore(store) {
  if (!hasLocalInstructionStore()) return false;
  try {
    const ok = await window.electronAPI.instructionsWrite(store);
    return !!ok;
  } catch {
    return false;
  }
}

function getBackendLabelForTarget(_target) {
  const c = cfg();
  return c.REALTIME_HTTP || "(realtime not set)";
}

function setProfilesUiEnabled(enabled) {
  if (profilesStylesEl) profilesStylesEl.style.display = enabled ? "" : "none";
  if (profilesDomainsEl) profilesDomainsEl.style.display = enabled ? "" : "none";
  if (profilesErrorEl) {
    if (!enabled) profilesErrorEl.textContent = "";
    profilesErrorEl.style.display = enabled ? "" : "none";
  }
}

// Voice view: instructions preview panel uses Direct Realtime instructions.
function getEffectiveInstructionsForEngine() {
  return (instructionStore?.realtime?.current || instructionStore?.realtime?.default || "").toString();
}

function updateVoiceInstructionsUI() {
  if (!voiceInstrTextEl) return;
  const eff = getEffectiveInstructionsForEngine().trim();
  voiceInstrTextEl.textContent = eff ? eff : "(nije učitano)";
  if (voiceInstrUpdatedAtEl) {
    const ua = (instructionStore?.realtime?.updatedAt || "").toString();
    voiceInstrUpdatedAtEl.textContent = ua ? ua : "(nije učitano)";
  }
}

function applyTargetDocToEditor(target, statusText, { silent } = {}) {
  const t = normalizeInstrTarget(target);
  const d = instructionStore?.[t] || emptyInstrDoc();
  if (instrCurrentEl) instrCurrentEl.value = (d.current || "").toString();
  if (instrDefaultEl) instrDefaultEl.value = (d.default || "").toString();
  if (instrUpdatedAtEl) instrUpdatedAtEl.textContent = (d.updatedAt || "").toString();
  if (instrBackendEl) instrBackendEl.textContent = getBackendLabelForTarget(t);
  if (instrStatusEl && statusText) instrStatusEl.textContent = statusText;

  setProfilesUiEnabled(false);

  updateVoiceInstructionsUI();

  if (!silent && d.updatedAt) push(`Instructions loaded (target=${t}) (${statusText || "ok"}) (${d.updatedAt})`);
}

async function fetchInstructionsFromBackend(_target) {
  const c = cfg();

  const res = await fetch(`${c.REALTIME_HTTP}/v1/instructions`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    current: (data.current || "").toString(),
    default: (data.default || "").toString(),
    updatedAt: (data.updatedAt || "").toString(),
    source: "backend",
    preset: normalizeStoredInstructionPresetKey(data.preset || ""),
  };
}

async function syncInstructionsToBackend(target, current, { silent } = {}) {
  const t = normalizeInstrTarget(target);
  const c = cfg();
  const url = `${c.REALTIME_HTTP}/v1/instructions`;

  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ current: (current || "").toString() }),
    });
    if (!r.ok) {
      if (!silent) push(`WARN: backend instructions sync failed (target=${t}) (HTTP ${r.status})`);
      return { ok: false, status: r.status };
    }
    return { ok: true, status: r.status };
  } catch {
    if (!silent) push(`WARN: backend instructions sync failed (target=${t}) (network error)`);
    return { ok: false, status: 0 };
  }
}

function selectInstructionPresetForDoc(doc) {
  const stored = normalizeStoredInstructionPresetKey(doc?.preset || "");
  const matched = findInstructionPresetForText(doc?.current || "") || findInstructionPresetForText(doc?.default || "");
  return setInstructionPreset(stored || matched || loadStrLS(LS_INSTRUCTION_PRESET, DEFAULT_INSTRUCTION_PRESET));
}

function ensureRealtimeInstructionStoreSeeded() {
  instructionStore = normalizeStore(instructionStore);
  const d = instructionStore.realtime || emptyInstrDoc();
  const current = (d.current || "").toString();
  const defaultText = (d.default || "").toString();
  let changed = false;

  if (!current.trim() && !defaultText.trim()) {
    const preset = setInstructionPreset(DEFAULT_INSTRUCTION_PRESET);
    const text = getInstructionPresetText(preset);
    instructionStore.realtime = {
      current: text,
      default: text,
      updatedAt: new Date().toISOString(),
      source: "preset-seed",
      preset,
    };
    return true;
  }

  if (!current.trim() && defaultText.trim()) {
    d.current = defaultText;
    changed = true;
  }
  if (!defaultText.trim() && current.trim()) {
    d.default = current;
    changed = true;
  }

  const preset = selectInstructionPresetForDoc(d);
  if (d.preset !== preset) {
    d.preset = preset;
    changed = true;
  }
  instructionStore.realtime = d;
  return changed;
}

async function applyInstructionPresetToEditor(presetKey) {
  const preset = setInstructionPreset(presetKey);
  const current = getInstructionPresetText(preset);
  const updatedAt = new Date().toISOString();

  setInstrTarget("realtime");
  instructionStore = instructionStore || normalizeStore(null);
  instructionStore.realtime = {
    current,
    default: current,
    updatedAt,
    source: "preset-ui",
    preset,
  };

  applyTargetDocToEditor("realtime", "Preset applied", { silent: true });

  let localOk = true;
  if (hasLocalInstructionStore()) {
    localOk = await writeLocalInstructionStore(instructionStore);
    if (!localOk) push("WARN: local preset write failed");
  }

  const sync = await syncInstructionsToBackend("realtime", current, { silent: true });
  if (instrStatusEl) {
    instrStatusEl.textContent = sync.ok
      ? (localOk ? "Preset applied + synced" : "Preset applied (local write failed)")
      : (localOk ? "Preset applied (sync failed)" : "Preset applied (local write failed, sync failed)");
  }
  if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
  push(`Instruction preset applied: ${preset}`);
}

async function loadInstructionStoreEffective({ silent } = {}) {
  // 1) Prefer local store (source of truth).
  const local = await readLocalInstructionStore();
  if (local) {
    instructionStore = local;
    const changed = ensureRealtimeInstructionStoreSeeded();
    if (changed && hasLocalInstructionStore()) {
      const ok = await writeLocalInstructionStore(instructionStore);
      if (!ok && !silent) push("WARN: local instructions seed write failed");
    }
    return instructionStore;
  }

  instructionStore = normalizeStore(null);
  ensureRealtimeInstructionStoreSeeded();
  if (hasLocalInstructionStore()) {
    const ok = await writeLocalInstructionStore(instructionStore);
    if (!ok && !silent) push("WARN: local instructions seed write failed");
  }
  return instructionStore;
}

async function loadInstructionsEffective({ silent } = {}) {
  await loadInstructionStoreEffective({ silent });
  const target = getInstrTarget();
  applyTargetDocToEditor(target, "Loaded (local)", { silent });
  return instructionStore;
}

// Explicit: load from backend (overwrites local for the target). Used only when user clicks "Load".
async function loadInstructionsFromBackendExplicit({ silent } = {}) {
  const target = getInstrTarget();

  try {
    const backend = await fetchInstructionsFromBackend(target);
    if (!backend) throw new Error("No backend data");
    const payload = {
      current: backend.current,
      default: backend.default,
      updatedAt: backend.updatedAt || new Date().toISOString(),
      source: "backend-load",
      preset: normalizeStoredInstructionPresetKey(backend.preset || "") || getInstructionPreset(),
    };

    instructionStore = instructionStore || normalizeStore(null);
    instructionStore[target] = payload;

    if (hasLocalInstructionStore()) {
      const ok = await writeLocalInstructionStore(instructionStore);
      if (!ok && !silent) push("WARN: local overwrite from backend failed");
    }

    applyTargetDocToEditor(target, "Loaded (backend)", { silent });
    return payload;
  } catch (e) {
    if (!silent) push(`WARN: instructions fetch failed (target=${target}): ${e?.message || e}`);
    if (instrStatusEl) instrStatusEl.textContent = "Load failed (check backend)";
    return null;
  }
}

async function saveInstructionsToBackend() {
  const target = getInstrTarget();
  const currentToSave = (instrCurrentEl?.value || "").toString();
  const defaultToSave = (instrDefaultEl?.value || "").toString();
  const updatedAt = new Date().toISOString();
  const preset = getInstructionPreset();

  instructionStore = instructionStore || normalizeStore(null);
  instructionStore[target] = {
    current: currentToSave,
    default: defaultToSave,
    updatedAt,
    source: "local-save",
    preset,
  };

  // Desktop/local-first (source of truth)
  if (hasLocalInstructionStore()) {
    const ok = await writeLocalInstructionStore(instructionStore);
    if (ok) {
      applyTargetDocToEditor(target, "Saved (local)", { silent: true });
      if (instrStatusEl) instrStatusEl.textContent = "Saved (local)";
      push(`Instructions saved locally (target=${target})`);

      // Best-effort backend sync (does NOT overwrite local)
      const sync = await syncInstructionsToBackend(target, currentToSave, { silent: true });
      if (instrStatusEl) {
        instrStatusEl.textContent = sync.ok ? "Saved (local) + synced" : "Saved (local) (sync failed)";
      }
      if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
      return;
    }

    if (instrStatusEl) instrStatusEl.textContent = "Local save failed; trying backend...";
  }

  // Backend fallback (non-Electron / local store unavailable)
  try {
    const sync = await syncInstructionsToBackend(target, currentToSave, { silent: false });
    if (instrStatusEl) instrStatusEl.textContent = sync.ok ? "Saved (backend)" : "Save failed";
    await loadInstructionsFromBackendExplicit({ silent: true });
  } catch {
    if (instrStatusEl) instrStatusEl.textContent = "Save failed (network error)";
  }
}

async function resetInstructionsToDefault() {
  const target = getInstrTarget();
  const preset = getInstructionPreset();
  const presetText = getInstructionPresetText(preset);
  const updatedAt = new Date().toISOString();
  const payload = {
    current: presetText,
    default: presetText,
    updatedAt,
    source: "preset-reset",
    preset,
  };

  instructionStore = instructionStore || normalizeStore(null);
  instructionStore[target] = payload;

  if (hasLocalInstructionStore()) {
    const ok = await writeLocalInstructionStore(instructionStore);
    if (!ok) {
      if (instrStatusEl) instrStatusEl.textContent = "Reset failed (local write)";
      push("WARN: local reset write failed");
      return;
    }

    applyTargetDocToEditor(target, "Reset (local)", { silent: true });
    if (instrStatusEl) instrStatusEl.textContent = "Reset (local)";
    push(`Instructions reset to preset default (target=${target}, preset=${preset})`);

    const sync = await syncInstructionsToBackend(target, payload.current, { silent: true });
    if (instrStatusEl) {
      instrStatusEl.textContent = sync.ok ? "Reset (local) + synced" : "Reset (local) (sync failed)";
    }
    if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
    return;
  }

  applyTargetDocToEditor(target, "Reset", { silent: true });
  try {
    const sync = await syncInstructionsToBackend(target, payload.current, { silent: false });
    if (instrStatusEl) instrStatusEl.textContent = sync.ok ? "Reset + synced" : "Reset (sync failed)";
  } catch {
    if (instrStatusEl) instrStatusEl.textContent = "Reset (network error)";
  }
}

async function refreshInstructionsPage() {
  const target = setInstrTarget("realtime");
  if (instrBackendEl) instrBackendEl.textContent = getBackendLabelForTarget(target);

  await loadInstructionStoreEffective({ silent: true });
  applyTargetDocToEditor(target, "Loaded (local)", { silent: true });
  setProfilesUiEnabled(false);
}

if (instrTargetEl) {
  instrTargetEl.addEventListener("change", () => {
    const t = setInstrTarget("realtime");
    try { refreshInstructionsPage().catch(() => {}); } catch {}
    updateVoiceInstructionsUI();
    push(`Instructions target set to: ${t}`);
  });
}

if (instructionPresetEl) {
  instructionPresetEl.addEventListener("change", () => {
    applyInstructionPresetToEditor(instructionPresetEl.value).catch((e) => {
      push(`WARN: preset apply failed: ${e?.message || e}`);
    });
  });
}
if (btnInstrSave) btnInstrSave.addEventListener("click", () => saveInstructionsToBackend().catch(() => {}));
if (btnInstrReset) btnInstrReset.addEventListener("click", () => resetInstructionsToDefault().catch(() => {}));
if (btnInstrRefresh) {
  btnInstrRefresh.addEventListener("click", () => {
    if (!rtWs || rtWs.readyState !== WebSocket.OPEN) {
      push("WARN: Realtime WS not connected; cannot refresh instructions.");
      return;
    }

    try {
      rtWs.send(JSON.stringify({
        type: "refresh_instructions"
      }));

      push("Refresh Instructions sent to realtime session.");
    } catch (e) {
      push(`ERROR: Instruction refresh failed: ${e?.message || e}`);
    }
  });
}

  // ------------------------------
  // Orchestrator REST
  // ------------------------------
  async function postTranscript(text) {
    const { ORCH_HTTP } = cfg();
    try {
      const r = await fetch(`${ORCH_HTTP}/v1/sessions/${sid}/transcripts`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ transcript: text }),
      });
      push(`Orchestrator transcripts POST status=${r.status}`);
    } catch (e) {
      push(`ERROR: Orchestrator transcripts POST failed: ${e?.message || e}`);
    }
  }
  async function postTurnDone(turnId) {
    const { ORCH_HTTP } = cfg();
    try {
      const r = await fetch(`${ORCH_HTTP}/v1/sessions/${sid}/turns/${turnId}/done`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      push(`turn_done POST status=${r.status} (turnId=${turnId})`);
    } catch (e) {
      push(`ERROR: Orchestrator turn_done POST failed: ${e?.message || e}`);
    }
  }
  // ------------------------------
  // Realtime output device selection (persisted) + Auto re-bind
  // ------------------------------
  async function enumerateAudioOutputs() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audiooutput");
    } catch (e) {
      push(`WARN: enumerateDevices failed: ${e?.message || e}`);
      return [];
    }
  }
  function isHeadphonesLabel(label) {
    return /headphone|headset|earbuds|earbud|buds/i.test(label || "");
  }
  function loadSavedRtDeviceId() {
    try { return (localStorage.getItem(LS_RT_DEVICE_ID) || "").trim(); } catch { return ""; }
  }
  function loadPreferredRtLabel() {
    try { return (localStorage.getItem(LS_RT_DEVICE_PREFERRED_LABEL) || "").trim(); } catch { return ""; }
  }
  function saveRtDeviceSelection(deviceId, label) {
    try {
      if (deviceId) localStorage.setItem(LS_RT_DEVICE_ID, deviceId);
      else localStorage.removeItem(LS_RT_DEVICE_ID);
      if (label) localStorage.setItem(LS_RT_DEVICE_LABEL, label);
      else localStorage.removeItem(LS_RT_DEVICE_LABEL);
      if (label) localStorage.setItem(LS_RT_DEVICE_PREFERRED_LABEL, label);
    } catch {}
  }
  async function refreshOutputDevicesUI() {
    const outputs = await enumerateAudioOutputs();
    const current = (rtDeviceSel.value || "").trim();
    const saved = loadSavedRtDeviceId();
    rtDeviceSel.innerHTML = "";
    const optAuto = document.createElement("option");
    optAuto.value = "";
    optAuto.textContent = "(auto)";
    rtDeviceSel.appendChild(optAuto);
    for (const d of outputs) {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label ? d.label : `(audiooutput ${d.deviceId.slice(0, 8)}…)`;
      rtDeviceSel.appendChild(opt);
    }
    if (current && outputs.some((o) => o.deviceId === current)) {
      rtDeviceSel.value = current;
    } else if (saved && outputs.some((o) => o.deviceId === saved)) {
      rtDeviceSel.value = saved;
    } else {
      rtDeviceSel.value = "";
    }
    push(`Audio outputs detected: ${outputs.length}`);
  }
  // Tracks last applied sink so we can "hold" it if headphones disappear.
  let lastAppliedSinkId = "";
  function getOutputLabelById(outputs, deviceId) {
    const d = outputs.find((x) => x.deviceId === deviceId);
    return d?.label || "";
  }
  async function findDeviceIdByExactLabel(outputs, preferredLabel) {
    if (!preferredLabel) return "";
    const hit = outputs.find((d) => (d.label || "").trim() === preferredLabel.trim());
    return hit ? hit.deviceId : "";
  }
  async function pickBestHeadphones(outputs) {
    // Prefer anything that looks like headphones/headset; no fallback to speakers.
    const hp = outputs.find((d) => isHeadphonesLabel(d.label));
    return hp ? hp.deviceId : "";
  }
  async function applyRealtimeSink() {
    if (typeof rtOutEl.setSinkId !== "function") {
      push("ERROR: rtOut.setSinkId is not supported in this Electron build. Direct Realtime requires headphones output.");
      return false;
    }
    const outputs = await enumerateAudioOutputs();
    // Candidate sources
    const dropdownId = (rtDeviceSel.value || "").trim();
    const savedId = loadSavedRtDeviceId();
    const preferredLabel = loadPreferredRtLabel();
    let candidateId = "";
    // 1) Explicit dropdown choice (but enforce headphones-only)
    if (dropdownId) {
      const lbl = getOutputLabelById(outputs, dropdownId);
      if (!REALTIME_HEADPHONES_ONLY || isHeadphonesLabel(lbl)) {
        candidateId = dropdownId;
      } else {
        push(`Realtime sink policy: headphones-only. Ignoring non-headphones selection: ${lbl || dropdownId}`);
        candidateId = "";
      }
    }
    // 2) Saved deviceId (only if it still exists and is headphones)
    if (!candidateId && savedId && outputs.some((o) => o.deviceId === savedId)) {
      const lbl = getOutputLabelById(outputs, savedId);
      if (!REALTIME_HEADPHONES_ONLY || isHeadphonesLabel(lbl)) {
        candidateId = savedId;
      } else {
        push(`Realtime sink policy: saved device is not headphones now (${lbl}). Will NOT switch to speakers.`);
      }
    }
    // 3) Preferred label match (useful after unplug/replug -> new deviceId)
    if (!candidateId && preferredLabel) {
      const byLabel = await findDeviceIdByExactLabel(outputs, preferredLabel);
      if (byLabel) {
        const lbl = getOutputLabelById(outputs, byLabel);
        if (!REALTIME_HEADPHONES_ONLY || isHeadphonesLabel(lbl)) {
          candidateId = byLabel;
        }
      }
    }
    // 4) Heuristic: any headphones/headset
    if (!candidateId) {
      candidateId = await pickBestHeadphones(outputs);
    }
    // If still none: do NOT switch to speakers. Hold current sink.
    if (!candidateId) {
      if (REALTIME_HEADPHONES_ONLY) {
        push("ERROR: Realtime sink: no headphones device available. Direct Realtime will not start.");
        return false;
      }
      push("WARN: No suitable output device found. Realtime will stay on current sink.");
      return false;
    }
    // If candidate is unchanged, skip
    if (candidateId === lastAppliedSinkId) return true;
    try {
      await rtOutEl.setSinkId(candidateId);
      // Update UI selection if possible
      if (candidateId && outputs.some((o) => o.deviceId === candidateId)) {
        rtDeviceSel.value = candidateId;
      }
      const label = getOutputLabelById(outputs, candidateId) || candidateId;
      saveRtDeviceSelection(candidateId, label);
      lastAppliedSinkId = candidateId;
      push(`Realtime output sink set to: ${label}`);
      return true;
    } catch (e) {
      const msg = e?.message || e;
      push(`ERROR: setSinkId failed: ${msg}`);
      return false;
    }
  }
  // Auto re-bind on device changes (debounced)
  let deviceChangeTimer = null;
  function onDeviceChange() {
    if (deviceChangeTimer) window.clearTimeout(deviceChangeTimer);
    deviceChangeTimer = window.setTimeout(async () => {
      deviceChangeTimer = null;
      push("Device change detected (audio outputs may have changed). Re-applying Realtime sink...");
      try {
        await refreshOutputDevicesUI();
        await applyRealtimeSink();
      } catch (e) {
        push(`WARN: device re-bind failed: ${e?.message || e}`);
      }
    }, 600);
  }
  // ------------------------------
  // Playback pipeline (Realtime) routed to rtOutEl via MediaStreamDestination
  // ------------------------------

  // Realtime audio diagnostics (throttled logging)
  // Goal: detect any sample_rate / channels drift or duration mismatch without flooding the log.
  const rtAudioDiag = {
    chunkCount: 0,
    lastLogMs: 0,
    lastSr: null,
    lastCh: null,
  };

  // ------------------------------
  // Legacy pause/buffer state. Direct Realtime audio is no longer enqueued;
  // incoming audio is played immediately and cleanup uses stopAudioNow().
  // ------------------------------
  const BUFFER_SECONDS = 120;
  let isAudioPaused = false;
  const audioQueue = []; // Array<{ bytes: Uint8Array, sampleRate: number, channels: number }>
  let bufferedBytes = 0;
  let lastFormat = null; // { sampleRate, channels }
  function bytesPerSecond(sampleRate, channels) {
    return sampleRate * channels * 2; // PCM16 => 2 bytes/sample
  }
  function updatePauseUi() {
    if (btnPauseAudio) {
      btnPauseAudio.textContent = isAudioPaused ? "Resume audio" : "Pause audio";
    }
    if (pauseInfoEl) {
      pauseInfoEl.textContent = isAudioPaused
        ? `Paused (buffered ~${(getBufferedSeconds()).toFixed(1)}s)`
        : "";
    }
  }
  function getBufferedSeconds() {
    if (!lastFormat) return 0;
    const bps = bytesPerSecond(lastFormat.sampleRate, lastFormat.channels);
    return bps > 0 ? (bufferedBytes / bps) : 0;
  }
  function clearBufferedAudio() {
    audioQueue.length = 0;
    bufferedBytes = 0;
    lastFormat = null;
    updatePauseUi();
  }
  function enqueueAudio(chunk) {
    audioQueue.push(chunk);
    bufferedBytes += chunk.bytes.byteLength;
    lastFormat = { sampleRate: chunk.sampleRate, channels: chunk.channels };
    const maxBytes = BUFFER_SECONDS * bytesPerSecond(chunk.sampleRate, chunk.channels);
    while (bufferedBytes > maxBytes && audioQueue.length > 0) {
      const dropped = audioQueue.shift();
      if (dropped) bufferedBytes -= dropped.bytes.byteLength;
    }
    updatePauseUi();
  }
  function playPcm16Bytes(bytes, sampleRate, channels) {
    // Ensure aligned to Int16; ignore odd trailing byte if present.
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    playPcm16(pcm16, sampleRate, channels);
  }
  function flushBufferedAudio() {
    if (!audioQueue.length) return;
    const queued = audioQueue.splice(0, audioQueue.length);
    bufferedBytes = 0;
    lastFormat = null;
    updatePauseUi();
    for (const chunk of queued) {
      playPcm16Bytes(chunk.bytes, chunk.sampleRate, chunk.channels);
    }
  }
  function stopAudioNow() {
    for (const src of Array.from(activePlaybackSources)) {
      try { src.stop(0); } catch {}
      try { src.disconnect(); } catch {}
    }
    activePlaybackSources.clear();
    audioQueue.length = 0;
    bufferedBytes = 0;
    lastFormat = null;
    isAudioPaused = false;
    updatePauseUi();
    try {
      playhead = playbackCtx ? playbackCtx.currentTime : 0;
    } catch {
      playhead = 0;
    }
    push("Audio stopped immediately");
  }
  async function setAudioPaused(paused) {
    const next = !!paused;
    if (next === isAudioPaused) return;
    isAudioPaused = next;
    updatePauseUi();
    try {
      // Suspending the playback context pauses already-scheduled audio cleanly.
      if (playbackCtx) {
        if (isAudioPaused && playbackCtx.state === "running") await playbackCtx.suspend();
        if (!isAudioPaused && playbackCtx.state === "suspended") await playbackCtx.resume();
      }
    } catch {}
    if (!isAudioPaused) {
      // Resume: continue from 'now' and flush buffered chunks.
      try {
        if (playbackCtx && playhead < playbackCtx.currentTime) playhead = playbackCtx.currentTime;
      } catch {}
      flushBufferedAudio();
    }
    push(isAudioPaused ? "Audio paused (incoming audio will be buffered)" : "Audio resumed");
  }

  function logRealtimeAudioChunk(pcmByteLength, sampleRate, channels) {
    const sr = Number(sampleRate || 24000);
    const ch = Math.max(1, Number(channels || 1));
    rtAudioDiag.chunkCount += 1;

    const nowMs = Date.now();
    const expectedSec = pcmByteLength / (2 * ch * sr); // 2 bytes per int16 sample
    const ctxRate = playbackCtx ? playbackCtx.sampleRate : null;

    // Log at most once per second, plus whenever sr/ch changes.
    const shouldLog =
      sr !== rtAudioDiag.lastSr ||
      ch !== rtAudioDiag.lastCh ||
      (nowMs - rtAudioDiag.lastLogMs) >= 1000;

    if (shouldLog) {
      rtAudioDiag.lastLogMs = nowMs;
      rtAudioDiag.lastSr = sr;
      rtAudioDiag.lastCh = ch;
      push(`RT_AUDIO: chunks=${rtAudioDiag.chunkCount} bytes=${pcmByteLength} sr=${sr} ch=${ch} expectedSec=${expectedSec.toFixed(3)} playbackCtxRate=${ctxRate}`);
    }

    // Always highlight unexpected metadata.
    if (sr !== 24000 || ch !== 1) {
      push(`WARN: RT_AUDIO metadata unexpected: sr=${sr} ch=${ch} (expected sr=24000 ch=1)`);
    }
  }

  async function ensurePlayback() {
    let sinkOk = false;
    if (!playbackCtx) {
           playbackCtx = new AudioContext({ sampleRate: 24000 });

      playbackGainNode = playbackCtx.createGain();
      playbackGainNode.gain.value = playbackVolume;

      playbackDest = playbackCtx.createMediaStreamDestination();

      playbackGainNode.connect(playbackDest);

      rtOutEl.srcObject = playbackDest.stream;
      try { await rtOutEl.play(); } catch {}
      push(`Playback AudioContext sampleRate=${playbackCtx.sampleRate}`);
      sinkOk = await applyRealtimeSink();
    } else {
      sinkOk = await applyRealtimeSink();
    }
    return sinkOk;
  }
  function playPcm16(pcm16, sampleRate, channels) {
    if (!playbackCtx || !playbackDest) return;
    const ctx = playbackCtx;
    const ch = Math.max(1, channels || 1);
    const frameCount = Math.floor(pcm16.length / ch);
    if (frameCount <= 0) return;
    const buffer = ctx.createBuffer(ch, frameCount, sampleRate);
    // Sanity-check: computed duration should match frameCount/sampleRate expectations.
    // If this spikes when the "voice changes", it's strong evidence of a sample-rate/channel mismatch.
    const expectedSec = frameCount / sampleRate;
    if (Math.abs(buffer.duration - expectedSec) > 0.02) {
      push(`WARN: RT_AUDIO duration mismatch: bufferSec=${buffer.duration.toFixed(3)} expectedSec=${expectedSec.toFixed(3)} sr=${sampleRate} ch=${ch} frames=${frameCount}`);
    }
    for (let c = 0; c < ch; c++) {
      const channelData = buffer.getChannelData(c);
      let idx = c;
      for (let i = 0; i < frameCount; i++, idx += ch) {
        channelData[i] = pcm16[idx] / 32768;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(playbackGainNode || playbackDest);
    activePlaybackSources.add(src);
    src.onended = () => {
      activePlaybackSources.delete(src);
    };
    const now = ctx.currentTime;
    if (playhead < now) playhead = now;
    src.start(playhead);
    playhead += buffer.duration;
  }
  // ------------------------------
  // Control WS
  // ------------------------------
  let activeTurnId = null;
  function connectControl() {
    if (controlWs && (controlWs.readyState === WebSocket.OPEN || controlWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const { ORCH_CONTROL_WS } = cfg();
    controlWs = new WebSocket(ORCH_CONTROL_WS);
    setControlStatus("RECONNECTING");
    controlWs.onopen = () => {
      setControlStatus("ON");
      push(`Control WS connected (sessionId=${sid})`);
      startControlPing();
      controlReconnectAttempt = 0;
      if (controlReconnectTimer) {
        try { window.clearTimeout(controlReconnectTimer); } catch {}
        controlReconnectTimer = null;
      }
      refreshButtons();
    };
    controlWs.onclose = (evt) => {
      const code = evt?.code;
      const reason = evt?.reason;
      const clean = evt?.wasClean;
      push(`Control WS closed (code=${code}, clean=${clean}, reason=${reason || ""})`);
      try { if (controlPingTimer) window.clearInterval(controlPingTimer); } catch {}
      controlPingTimer = null;
      controlWs = null;
      refreshButtons();
      if (fullPipelineTestActive) {
        failFullPipelineTest("Control WS closed");
      }
      if (desiredConnected) scheduleControlReconnect("closed");
      else setControlStatus("OFF");
    };
    controlWs.onerror = () => {
      push("Control WS error");
      if (fullPipelineTestActive) {
        failFullPipelineTest("Control WS error");
      }
    };
    controlWs.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      let cmd;
      try { cmd = JSON.parse(e.data); } catch { return; }
      if (cmd.command === "SEND_TO_REALTIME") {
        const { turnId, text } = cmd.payload || {};
        if (!turnId || !text) return;
        push(`COMMAND SEND_TO_REALTIME (turnId=${turnId})`);
        activeTurnId = turnId;
        const effInstr = fullPipelineTestActive
          ? FULL_PIPELINE_TEST_INSTRUCTIONS
          : getEffectiveInstructionsForEngine().toString();
        const cleanText = (text ?? "").toString();
        if (fullPipelineTestActive) {
          push("Full pipeline test instructions override applied.");
        }
        if (rtWs && rtWs.readyState === WebSocket.OPEN) {
          rtWs.send(JSON.stringify({
            type: "SEND_TEXT",
            text: cleanText,
            instructions: effInstr
          }));
        } else {
          push("ERROR: Realtime WS not open; cannot SEND_TEXT");
          if (fullPipelineTestActive) {
            failFullPipelineTest("Realtime WS not open when SEND_TO_REALTIME arrived");
          }
        }
      }
    };
  }
  // ------------------------------
  // Realtime WS
  // ------------------------------
  async function connectRealtime() {
    if (rtWs && (rtWs.readyState === WebSocket.OPEN || rtWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const { VOICE_WS, VOICE_ENGINE, REALTIME_RATE } = cfg();
    const playbackReady = await ensurePlayback();
    if (!playbackReady) {
      setRealtimeStatus("OFF");
      refreshButtons();
      return;
    }
    rtWs = new WebSocket(VOICE_WS);
    rtWsEngine = VOICE_ENGINE;
    setRealtimeStatus("RECONNECTING");
    rtWs.onopen = () => {
      setRealtimeStatus("ON");
      push(`Voice WS connected (engine=${VOICE_ENGINE}${VOICE_ENGINE === "realtime" ? " rate=" + REALTIME_RATE : ""})`);
      startRealtimePing();
      flushDirectFramePending();
      rtReconnectAttempt = 0;
      if (rtReconnectTimer) {
        try { window.clearTimeout(rtReconnectTimer); } catch {}
        rtReconnectTimer = null;
      }
      refreshButtons();
    };
    rtWs.onclose = (evt) => {
      const code = evt?.code;
      const reason = evt?.reason;
      const clean = evt?.wasClean;
      push(`Realtime WS closed (code=${code}, clean=${clean}, reason=${reason || ""})`);
      try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
      rtPingTimer = null;
      rtWs = null;
      rtWsEngine = "";
      refreshButtons();
      if (directRealtimeActive || directRealtimeStarting) {
        stopDirectRealtime({ closeRealtime: false, silent: true }).catch(() => {});
        push("Direct Realtime stopped because Voice WS closed.");
      }
      if (fullPipelineTestActive) {
        failFullPipelineTest("Realtime WS closed");
      }
      if (rtReconnectSuppressOnce) {
        rtReconnectSuppressOnce = false;
        setRealtimeStatus("OFF");
        return;
      }
      if (desiredConnected) scheduleRealtimeReconnect("closed");
      else setRealtimeStatus("OFF");
    };
    rtWs.onerror = () => {
      push("Realtime WS error");
      if (fullPipelineTestActive) {
        failFullPipelineTest("Realtime WS error");
      }
    };
    rtWs.onmessage = async (e) => {
      if (typeof e.data !== "string") return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "audio") {
        const pcmBytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
        // Diagnostics: log expected duration and metadata (throttled).
        logRealtimeAudioChunk(pcmBytes.byteLength, msg.sample_rate || 24000, msg.channels || 1);
        const pcm16 = new Int16Array(
          pcmBytes.buffer,
          pcmBytes.byteOffset,
          Math.floor(pcmBytes.byteLength / 2)
        );
        isAssistantSpeaking = true;
        playPcm16(pcm16, msg.sample_rate || 24000, msg.channels || 1);
        return;
      }
      if (msg.type === "log") {
        push(msg.message || JSON.stringify(msg));
        const logText = String(msg.event || msg.message || "");
      if (logText.includes("input_audio_buffer.speech_started")) {
         stopAudioNow();
          try { rtWs.send(JSON.stringify({ type: "response.cancel" })); } catch {}
          isAssistantSpeaking = false;
           push("Barge-in detected: cancelled current response and stopped local playback");
    }
        return;
      }
      if (msg.type === "error") {
        push(`ERROR(Realtime): ${msg.message || "unknown error"}`);
        return;
      }
      if (msg.type === "agent_done") {
        isAssistantSpeaking = false;
        if (directRealtimeActive || directRealtimeStarting) {
          push("Direct Realtime response done");
          return;
        }
        if (!activeTurnId) {
          push("agent_done received but no activeTurnId");
          return;
        }
        const turnId = activeTurnId;
        activeTurnId = null;
        push(`agent_done (turnId=${turnId})`);
        await postTurnDone(turnId);
        if (fullPipelineTestActive) {
          finishFullPipelineTest(true);
        }
      }
    };
  }
  // ------------------------------
  // STT (loopback)
  // ------------------------------
  let sttWs = null;
  let sttCtx = null;
  let sttStream = null;
  let analyser = null;
  let analyserTimer = null;
  let sttPending = [];
  let sttBuffer = [];
  let flushTimer = null;
  let fullPipelineTestActive = false;
  let fullPipelineTestWs = null;
  let fullPipelineTestTimer = null;
  let directRealtimeActive = false;
  let directRealtimeStarting = false;
  let directStream = null;
  let directCtx = null;
  let directSource = null;
  let directNode = null;
  let directAudioChunks = [];
  let directAudioBytes = 0;
  let directFramePending = [];
  const FLUSH_MS = 1200;
  const FULL_PIPELINE_TEST_TIMEOUT_MS = 30000;
  const DIRECT_PCM_CHUNK_BYTES = 960; // 20ms @ 24kHz mono PCM16
  const DIRECT_FRAME_PENDING_LIMIT = 80;
  function clearFlushTimer() {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
  function stopAnalyser() {
    if (analyserTimer) {
      window.clearInterval(analyserTimer);
      analyserTimer = null;
    }
    analyser = null;
  }
  function startAnalyser() {
    if (!analyser || !sttCtx) return;
    const buf = new Float32Array(analyser.fftSize);
    if (analyserTimer) window.clearInterval(analyserTimer);
    analyserTimer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      push(`AUDIO_LEVEL_RMS: ${rms.toFixed(5)}`);
    }, 1500);
  }
  async function flushSttBuffer() {
    if (!sttBuffer.length) return;
    const full = sttBuffer.join(" ").trim();
    sttBuffer = [];
    if (!full) return;
    push(`STT_BUFFER_FLUSH: ${full}`);
    await postTranscript(full);
  }
  function handleSttMessage(msg) {
    if (msg.type === "STT_FINAL") {
      const chunk = (msg.transcript || "").trim();
      if (!chunk) return;
      push(`STT_FINAL: ${chunk}`);
      sttBuffer.push(chunk);
      const endsSentence = /[?.!]\s*$/.test(chunk);
      clearFlushTimer();
      const timeout = endsSentence ? 450 : FLUSH_MS;
      flushTimer = window.setTimeout(() => {
        flushSttBuffer().catch(() => {});
        flushTimer = null;
      }, timeout);
    } else if (msg.type === "STT_ERROR") {
      push(`STT_ERROR: ${msg.error || "unknown"}`);
      if (fullPipelineTestActive) {
        failFullPipelineTest(msg.error || "STT error");
      }
    } else if (msg.type === "STT_MODE") {
      // Normalize server mode line for quick diagnostics (matches your log pattern).
      const requested = (getSttLanguage() || "").toString();
      const serverLang = (msg.language || msg.lang || msg.locale || "").toString();
      const supported = Array.isArray(msg.supported) ? msg.supported.join(",") : (msg.supported || "");
      push(`STT_MODE: mode=${msg.mode} requested=${requested} server=${serverLang || requested} supported=${supported}`);
    } else {
      push(`STT WS msg: ${JSON.stringify(msg)}`);
    }
  }
  function handleSttMessageData(data) {
    if (typeof data !== "string") return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    handleSttMessage(msg);
  }
  function readAscii(view, offset, length) {
    let out = "";
    for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
    return out;
  }
  function decodePcm16Wav(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 44) {
      throw new Error("WAV file is too small");
    }
    const view = new DataView(arrayBuffer);
    if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
      throw new Error("WAV file must be RIFF/WAVE");
    }
    let fmt = null;
    let dataOffset = -1;
    let dataSize = 0;
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const chunkId = readAscii(view, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkSize;
      if (chunkEnd > view.byteLength) {
        throw new Error(`WAV chunk ${chunkId} exceeds file length`);
      }
      if (chunkId === "fmt ") {
        if (chunkSize < 16) throw new Error("WAV fmt chunk is too small");
        fmt = {
          audioFormat: view.getUint16(chunkStart, true),
          channels: view.getUint16(chunkStart + 2, true),
          sampleRate: view.getUint32(chunkStart + 4, true),
          bitsPerSample: view.getUint16(chunkStart + 14, true),
        };
      } else if (chunkId === "data") {
        dataOffset = chunkStart;
        dataSize = chunkSize;
      }
      offset = chunkEnd + (chunkSize % 2);
    }
    if (!fmt) throw new Error("WAV fmt chunk not found");
    if (fmt.audioFormat !== 1) throw new Error(`WAV must be PCM format 1; found ${fmt.audioFormat}`);
    if (fmt.channels !== 1) throw new Error(`WAV must be mono; found ${fmt.channels} channels`);
    if (fmt.sampleRate !== 16000) throw new Error(`WAV must be 16000 Hz; found ${fmt.sampleRate} Hz`);
    if (fmt.bitsPerSample !== 16) throw new Error(`WAV must be signed 16-bit; found ${fmt.bitsPerSample}-bit`);
    if (dataOffset < 0 || dataSize <= 0) throw new Error("WAV data chunk not found");
    if (dataSize % 2 !== 0) throw new Error("WAV PCM16 data length must be even");
    return {
      pcm: new Uint8Array(arrayBuffer, dataOffset, dataSize),
      durationSec: dataSize / 2 / fmt.sampleRate,
    };
  }
  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  function readArrayBufferWithXhr(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = () => {
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
          resolve(xhr.response);
          return;
        }
        reject(new Error(`test audio load failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("test audio load failed"));
      xhr.send();
    });
  }
  async function loadFullPipelineTestAudio() {
    const url = new URL(FULL_PIPELINE_TEST_AUDIO_URL, window.location.href).toString();
    let arrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok && res.status !== 0) throw new Error(`test audio load failed (${res.status})`);
      arrayBuffer = await res.arrayBuffer();
    } catch {
      arrayBuffer = await readArrayBufferWithXhr(url);
    }
    const decoded = decodePcm16Wav(arrayBuffer);
    push(`Full pipeline test audio loaded (${decoded.pcm.byteLength} bytes, ${decoded.durationSec.toFixed(2)}s)`);
    return decoded.pcm;
  }
  function openFullPipelineTestSttWs() {
    return new Promise((resolve, reject) => {
      const { STT_WS } = cfg();
      let opened = false;
      push(`Full pipeline test connecting STT WS: ${STT_WS}`);
      const ws = new WebSocket(STT_WS);
      fullPipelineTestWs = ws;
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        opened = true;
        push("Full pipeline test STT WS connected");
        refreshButtons();
        resolve(ws);
      };
      ws.onmessage = (evt) => handleSttMessageData(evt.data);
      ws.onerror = () => {
        if (!opened) {
          reject(new Error("STT WS error"));
          return;
        }
        if (fullPipelineTestActive) {
          failFullPipelineTest("STT WS error");
        }
      };
      ws.onclose = (evt) => {
        const code = evt?.code;
        const reason = evt?.reason;
        const clean = evt?.wasClean;
        push(`Full pipeline test STT WS closed (code=${code}, clean=${clean}, reason=${reason || ""})`);
        if (fullPipelineTestWs === ws) fullPipelineTestWs = null;
        refreshButtons();
        if (!opened) {
          reject(new Error(`STT WS closed before open (code=${code})`));
          return;
        }
        if (fullPipelineTestActive && code !== 1000 && code !== 1005) {
          failFullPipelineTest(`STT WS closed unexpectedly (code=${code})`);
        }
      };
    });
  }
  async function streamFullPipelineTestAudio(ws, pcmBytes) {
    const chunkBytes = 640;
    for (let offset = 0; offset < pcmBytes.byteLength; offset += chunkBytes) {
      if (!fullPipelineTestActive) return;
      if (ws.readyState !== WebSocket.OPEN) throw new Error("STT WS closed while streaming test audio");
      ws.send(pcmBytes.slice(offset, Math.min(offset + chunkBytes, pcmBytes.byteLength)));
      await sleep(20);
    }
    const silence = new Uint8Array(chunkBytes);
    for (let i = 0; i < 125; i++) {
      if (!fullPipelineTestActive) return;
      if (ws.readyState !== WebSocket.OPEN) throw new Error("STT WS closed while streaming test silence");
      ws.send(silence);
      await sleep(20);
    }
    push("Full pipeline test trailing silence streamed (2500ms)");
  }
  function clearFullPipelineTestTimer() {
    if (fullPipelineTestTimer) {
      window.clearTimeout(fullPipelineTestTimer);
      fullPipelineTestTimer = null;
    }
  }
  function closeFullPipelineTestWs() {
    const ws = fullPipelineTestWs;
    fullPipelineTestWs = null;
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      try { ws.close(1000, "full-pipeline-test-complete"); } catch {}
    }
  }
  function finishFullPipelineTest(success, reason) {
    const wasActive = fullPipelineTestActive;
    fullPipelineTestActive = false;
    clearFullPipelineTestTimer();
    closeFullPipelineTestWs();
    if (!success) {
      clearFlushTimer();
      sttBuffer = [];
    }
    refreshButtons();
    if (success) {
      push("Full pipeline test completed");
    } else if (wasActive) {
      push(`Full pipeline test failed: ${reason || "unknown error"}`);
    }
  }
  function failFullPipelineTest(reason) {
    finishFullPipelineTest(false, reason);
  }
  async function startFullPipelineTest() {
    if (fullPipelineTestActive) {
      push("Full pipeline test failed: already running");
      return;
    }
    const controlOk = controlWs && controlWs.readyState === WebSocket.OPEN;
    const rtOk = rtWs && rtWs.readyState === WebSocket.OPEN;
    if (!controlOk || !rtOk) {
      push("Full pipeline test requires Control WS and Realtime WS to be connected.");
      return;
    }
    if (sttWs && sttWs.readyState !== WebSocket.CLOSED) {
      push("Full pipeline test requires live STT to be stopped first.");
      return;
    }
    fullPipelineTestActive = true;
    clearFlushTimer();
    sttBuffer = [];
    push("Full pipeline test started");
    fullPipelineTestTimer = window.setTimeout(() => {
      failFullPipelineTest("timeout waiting for STT/Agent/Realtime");
    }, FULL_PIPELINE_TEST_TIMEOUT_MS);
    refreshButtons();
    try {
      const pcmBytes = await loadFullPipelineTestAudio();
      if (!fullPipelineTestActive) return;
      const ws = await openFullPipelineTestSttWs();
      if (!fullPipelineTestActive) return;
      await streamFullPipelineTestAudio(ws, pcmBytes);
      if (!fullPipelineTestActive) return;
      push("Full pipeline test audio streamed");
      push("Full pipeline test waiting for STT/Agent/Realtime");
    } catch (e) {
      failFullPipelineTest(e?.message || e);
    }
  }
  async function getLoopbackStream() {
    await window.electronAPI.enableLoopbackAudio();
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      try {
        media.getVideoTracks().forEach((t) => t.stop());
        media.getVideoTracks().forEach((t) => media.removeTrack(t));
      } catch {}
      return media;
    } finally {
      try { await window.electronAPI.disableLoopbackAudio(); } catch {}
    }
  }
  function setDirectStatusOn(on, text) {
    setPill("sttStatus", on ? "ok" : "bad", text || (on ? "DIRECT: ON" : "DIRECT: OFF"));
  }
  function forceRealtimeEngineForDirect() {
    if (getVoiceEngine() === "realtime") return false;
    try { if (voiceEngineVoiceEl) voiceEngineVoiceEl.value = "realtime"; } catch {}
    try { if (voiceEngineEl) voiceEngineEl.value = "realtime"; } catch {}
    saveStrLS(LS_VOICE_ENGINE, "realtime");
    applyVoiceEngineUiState("realtime");
    updateVoiceInstructionsUI();
    push("Direct Realtime forced Voice Engine to realtime.");
    return true;
  }
  async function prepareRealtimeSocketForDirect() {
    forceRealtimeEngineForDirect();
    if (rtWs && rtWsEngine && rtWsEngine !== "realtime") {
      rtReconnectSuppressOnce = true;
      try { rtWs.close(1000, "direct-realtime-engine-switch"); } catch {}
      rtWs = null;
      rtWsEngine = "";
      await sleep(100);
    }
  }
  function waitForRealtimeOpen(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (rtWs && rtWs.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      if (!rtWs) {
        reject(new Error("Realtime WS was not created"));
        return;
      }

      let timer = null;
      const ws = rtWs;
      const cleanup = () => {
        try { ws.removeEventListener("open", onOpen); } catch {}
        try { ws.removeEventListener("error", onError); } catch {}
        try { ws.removeEventListener("close", onClose); } catch {}
        try { if (timer) window.clearTimeout(timer); } catch {}
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Realtime WS error while opening"));
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Realtime WS closed before opening"));
      };

      try { ws.addEventListener("open", onOpen); } catch {}
      try { ws.addEventListener("error", onError); } catch {}
      try { ws.addEventListener("close", onClose); } catch {}
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for Realtime WS"));
      }, timeoutMs || 10000);
    });
  }
  function flushDirectFramePending() {
    if (!rtWs || rtWs.readyState !== WebSocket.OPEN || directFramePending.length === 0) return;
    const queued = directFramePending.splice(0, directFramePending.length);
    for (const buf of queued) {
      try { rtWs.send(buf); } catch {}
    }
  }
  function sendDirectFrame(buf) {
    if (!buf || (!directRealtimeActive && !directRealtimeStarting)) return;
    if (rtWs && rtWs.readyState === WebSocket.OPEN) {
      try { rtWs.send(buf); } catch {}
      return;
    }
    if (rtWs && rtWs.readyState === WebSocket.CONNECTING) {
      directFramePending.push(buf);
      while (directFramePending.length > DIRECT_FRAME_PENDING_LIMIT) directFramePending.shift();
    }
  }
  function flushDirectAudioChunks() {
    if (directAudioBytes <= 0) return;
    const out = new Uint8Array(directAudioBytes);
    let offset = 0;
    for (const chunk of directAudioChunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    directAudioChunks = [];
    directAudioBytes = 0;
    sendDirectFrame(out.buffer);
  }
  function queueDirectAudio(buf) {
    if (!buf || !directRealtimeActive) return;
    const bytes = new Uint8Array(buf);
    directAudioChunks.push(bytes);
    directAudioBytes += bytes.byteLength;
    if (directAudioBytes >= DIRECT_PCM_CHUNK_BYTES) flushDirectAudioChunks();
  }
  async function stopLegacySttCaptureOnly(reason) {
    clearFlushTimer();
    sttBuffer = [];
    sttPending = [];
    stopAnalyser();
    try { sttWs?.close(1000, reason || "direct-realtime"); } catch {}
    sttWs = null;
    try { sttStream?.getTracks().forEach((t) => t.stop()); } catch {}
    sttStream = null;
    try { loopMonitor.pause(); loopMonitor.srcObject = null; } catch {}
    try { await sttCtx?.close(); } catch {}
    sttCtx = null;
  }
  function disconnectControlForDirect() {
    if (!controlWs) return;
    const ws = controlWs;
    controlWs = null;
    try { if (controlPingTimer) window.clearInterval(controlPingTimer); } catch {}
    controlPingTimer = null;
    try { ws.onclose = null; } catch {}
    try { ws.onerror = null; } catch {}
    try { ws.onmessage = null; } catch {}
    try { ws.close(1000, "direct-realtime"); } catch {}
    setControlStatus("OFF");
  }
  async function startDirectRealtime() {
    if (directRealtimeActive || directRealtimeStarting) {
      push("Direct Realtime is already running.");
      return;
    }
    if (fullPipelineTestActive) {
      push("Direct Realtime cannot start while Full Pipeline Test is running.");
      return;
    }

    directRealtimeStarting = true;
    setDirectStatusOn(false, "DIRECT: STARTING");
    refreshButtons();

    try {
      if (sttWs || sttStream || sttCtx) {
        await stopLegacySttCaptureOnly("direct-realtime-start");
      }
      disconnectControlForDirect();

      await prepareRealtimeSocketForDirect();
      await refreshOutputDevicesUI();
      const playbackReady = await ensurePlayback();
      if (!playbackReady) throw new Error("Headphones output is required for Direct Realtime.");

      desiredConnected = true;
      clearReconnectTimers();
      if (!rtWs || (rtWs.readyState !== WebSocket.OPEN && rtWs.readyState !== WebSocket.CONNECTING)) {
        await connectRealtime();
      }
      await waitForRealtimeOpen(10000);

      directStream = await getLoopbackStream();
      const audioTracks = directStream.getAudioTracks();
      if (!audioTracks.length) throw new Error("Loopback capture returned no audio tracks.");
      push(`Direct loopback audio tracks: ${audioTracks.length}`);
      audioTracks.forEach((t, i) =>
        push(`  [${i}] label="${t.label}" enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
      );

      loopMonitor.srcObject = directStream;
      try { await loopMonitor.play(); } catch {}

      directCtx = new AudioContext();
      push(`Direct AudioContext sampleRate=${directCtx.sampleRate}`);
      const workletUrl = new URL("stt-worklet-processor.js", window.location.href).toString();
      await directCtx.audioWorklet.addModule(workletUrl);

      directSource = directCtx.createMediaStreamSource(directStream);
      directNode = new AudioWorkletNode(directCtx, "direct-realtime-pcm16-24k");
      directNode.port.onmessage = (e) => queueDirectAudio(e.data);

      directRealtimeActive = true;
      directSource.connect(directNode);
      setDirectStatusOn(true);
      push("Direct Realtime streaming started (loopback PCM16@24k mono -> /voice/ws).");
    } catch (e) {
      push(`ERROR(Direct Realtime start): ${e?.message || e}`);
      await stopDirectRealtime({ closeRealtime: true, silent: true });
      setDirectStatusOn(false);
    } finally {
      directRealtimeStarting = false;
      refreshButtons();
    }
  }
  async function stopDirectRealtime(options) {
    const opts = options || {};
    const closeRealtime = opts.closeRealtime !== false;
    const silent = !!opts.silent;
    const wasRunning = directRealtimeActive || directRealtimeStarting || !!directStream || !!directCtx;

    directRealtimeActive = false;
    directRealtimeStarting = false;
    isAssistantSpeaking = false;
    directAudioChunks = [];
    directAudioBytes = 0;
    directFramePending = [];
    try { stopAudioNow(); } catch {}

    try { directNode?.port && (directNode.port.onmessage = null); } catch {}
    try { directNode?.disconnect(); } catch {}
    directNode = null;
    try { directSource?.disconnect(); } catch {}
    directSource = null;

    const oldStream = directStream;
    directStream = null;
    try { oldStream?.getTracks().forEach((t) => t.stop()); } catch {}
    try { loopMonitor.pause(); loopMonitor.srcObject = null; } catch {}

    const oldCtx = directCtx;
    directCtx = null;
    try { await oldCtx?.close(); } catch {}

    activeTurnId = null;

    if (closeRealtime) {
      desiredConnected = false;
      clearReconnectTimers();
      try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
      rtPingTimer = null;
      const ws = rtWs;
      rtWs = null;
      rtWsEngine = "";
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        try { ws.close(1000, "direct-realtime-stop"); } catch {}
      }
      setRealtimeStatus("OFF");
    }

    setDirectStatusOn(false);
    refreshButtons();
    if (!silent && wasRunning) push("Direct Realtime stopped.");
  }
  async function startStt() {
    if (!getSttEnabled()) {
      push("STT is disabled (STT Enabled is OFF).");
      return;
    }
    const { STT_WS } = cfg();
    sttBuffer = [];
    clearFlushTimer();
    sttPending = [];
    sttStream = await getLoopbackStream();
    const audioTracks = sttStream.getAudioTracks();
    push(`Loopback audio tracks: ${audioTracks.length}`);
    audioTracks.forEach((t, i) =>
      push(`  [${i}] label="${t.label}" enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
    );
    loopMonitor.srcObject = sttStream;
    try { await loopMonitor.play(); } catch {}
    sttCtx = new AudioContext();
    push(`AudioContext sampleRate=${sttCtx.sampleRate}`);
    const src = sttCtx.createMediaStreamSource(sttStream);
    analyser = sttCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    startAnalyser();
    const workletUrl = new URL("stt-worklet-processor.js", window.location.href).toString();
    await sttCtx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(sttCtx, "stt-pcm16-16k");
    src.connect(node);
    node.port.onmessage = (e) => {
      const buf = e.data;
      if (!sttWs) return;
      if (sttWs.readyState === WebSocket.OPEN) {
        sttWs.send(buf);
      } else if (sttWs.readyState === WebSocket.CONNECTING) {
        sttPending.push(buf);
        if (sttPending.length > 80) sttPending.shift();
      }
    };
    push(`Connecting STT WS: ${STT_WS}`);
    sttWs = new WebSocket(STT_WS);
    sttWs.binaryType = "arraybuffer";
    refreshButtons();
    sttWs.onopen = () => {
      push("STT WS connected");
      for (const buf of sttPending) {
        try { sttWs.send(buf); } catch {}
      }
      sttPending = [];
      refreshButtons();
    };
    sttWs.onclose = (evt) => {
      const code = evt?.code;
      const reason = evt?.reason;
      const clean = evt?.wasClean;
      push(`STT WS closed (code=${code}, clean=${clean}, reason=${reason || ""})`);
      sttWs = null;
      setPill("sttStatus", "bad", "STT: OFF");
      refreshButtons();
    };
    sttWs.onerror = () => push("STT WS error");
    sttWs.onmessage = (evt) => {
      handleSttMessageData(evt.data);
    };
    setPill("sttStatus", "ok", "STT: ON");
    push(`STT streaming started (PCM16@16k mono). Language=${getSttLanguage()}`);
    refreshButtons();
  }
  async function stopStt() {
    clearFlushTimer();
    try { await flushSttBuffer(); } catch {}
    stopAnalyser();
    try { sttWs?.close(1000, "stop"); } catch {}
    sttWs = null;
    try { sttStream?.getTracks().forEach((t) => t.stop()); } catch {}
    sttStream = null;
    try { loopMonitor.pause(); loopMonitor.srcObject = null; } catch {}
    try { await sttCtx?.close(); } catch {}
    sttCtx = null;
    setPill("sttStatus", "bad", "STT: OFF");
    push("STT stopped");
    refreshButtons();
  }
  function refreshButtons() {
    const controlOk = controlWs && controlWs.readyState === WebSocket.OPEN;
    const rtOk = rtWs && rtWs.readyState === WebSocket.OPEN;
    const sttOk = !!sttWs && sttWs.readyState !== WebSocket.CLOSED;
    const directBusy = directRealtimeActive || directRealtimeStarting;
    // Pause/Resume button is enabled only when Voice WS is open.
    if (btnPauseAudio) {
      btnPauseAudio.disabled = !rtOk;
    }
    $("btnStart").disabled = directBusy || fullPipelineTestActive;
    $("btnStop").disabled = !(directBusy || sttOk);
    if (btnTestFullPipeline) {
      btnTestFullPipeline.disabled = directBusy;
    }
  }
  // ------------------------------
  // Reset Session (Ready state; user clicks Connect)
  // ------------------------------
  async function resetSessionToReady() {
    push("Reset session requested...");
    if (fullPipelineTestActive) {
      failFullPipelineTest("session reset");
    }
    desiredConnected = false;
    clearReconnectTimers();
    clearPingTimers();
    try { await stopDirectRealtime({ closeRealtime: true, silent: true }); } catch {}
    try { await stopLegacySttCaptureOnly("reset"); } catch {}
    try { controlWs?.close(1000, "reset"); } catch {}
    try { rtWs?.close(1000, "reset"); } catch {}
    controlWs = null;
    rtWs = null;
    rtWsEngine = "";
    activeTurnId = null;
    controlReconnectAttempt = 0;
    rtReconnectAttempt = 0;
    sid =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : ("test-" + Math.random().toString(16).slice(2));
    $("sid").textContent = sid;
    setDirectStatusOn(false);
    setControlStatus("OFF");
    setRealtimeStatus("OFF");
    refreshButtons();
    push(`Session reset complete. New sessionId=${sid}. Ready for Direct Realtime.`);
  }
  // ------------------------------
  // Instructions Page (editor + profiles)
  // ------------------------------
  let profilesLoadedOnce = false;
  function extractDomainBlock(text) {
    const parts = (text || "").split("\n---\n");
    const domainCandidate = parts.find((b, idx) => idx === 2 && b.startsWith("CONTENT INSTRUCTIONS:"));
    return domainCandidate ?? null;
  }
  function extractRulesBlock(text) {
    const parts = (text || "").split("\n---\n");
    const rules = parts.find((b) => b.startsWith("RULES:"));
    return rules ?? FIXED_RULES;
  }

  // ------------------------------
  // Canonical instruction sections (ROLE / SPEECH / CONTENT / FORMAT / RULES)
  // Goal: sections are never lost; plain-text paste is routed into CONTENT.
  // Backward compatible with legacy (SPEECH BEHAVIOR / CONTENT INSTRUCTIONS) format.
  // ------------------------------
  function _stripHeader(block, header) {
    const t = (block || "").toString().replace(/\r/g, "");
    const h = header.endsWith(":") ? header : (header + ":");
    if (t.startsWith(h)) return t.slice(h.length).replace(/^\n/, "");
    return t;
  }

  function _hasAnyHeader(text) {
    const t = (text || "").toString();
    return /(^|\n)(ROLE:|SPEECH:|CONTENT:|FORMAT:|RULES:|SPEECH BEHAVIOR:|CONTENT INSTRUCTIONS:)\s*/.test(t);
  }

  function parseInstructionSectionsAny(text) {
    const t = (text || "").toString().replace(/\r/g, "");
    const parts = t.split("\n---\n").map((p) => p.trimEnd());

    let role = "";
    let speech = "";
    let content = "";
    let format = "";
    let rules = "";

    // Canonical blocks first
    for (const b of parts) {
      if (!b) continue;
      if (b.startsWith("ROLE:")) role = _stripHeader(b, "ROLE:");
      else if (b.startsWith("SPEECH:")) speech = _stripHeader(b, "SPEECH:");
      else if (b.startsWith("CONTENT:")) content = _stripHeader(b, "CONTENT:");
      else if (b.startsWith("FORMAT:")) format = _stripHeader(b, "FORMAT:");
      else if (b.startsWith("RULES:")) rules = _stripHeader(b, "RULES:");
    }

    // Legacy support: SPEECH BEHAVIOR + (CONTENT INSTRUCTIONS xN) + RULES
    if (!role && !speech && !content && !format) {
      let legacySpeech = "";
      const legacyContents = [];
      for (const b of parts) {
        if (!b) continue;
        if (b.startsWith("SPEECH BEHAVIOR:")) legacySpeech = _stripHeader(b, "SPEECH BEHAVIOR:");
        else if (b.startsWith("CONTENT INSTRUCTIONS:")) legacyContents.push(_stripHeader(b, "CONTENT INSTRUCTIONS:"));
        else if (b.startsWith("RULES:")) rules = _stripHeader(b, "RULES:");
      }

      // Map legacy: speech -> SPEECH; first CONTENT INSTRUCTIONS -> FORMAT (style),
      // second CONTENT INSTRUCTIONS -> CONTENT (domain). If only one, map to CONTENT.
      speech = legacySpeech;
      if (legacyContents.length === 1) {
        content = legacyContents[0];
      } else if (legacyContents.length >= 2) {
        format = legacyContents[0];
        content = legacyContents[1];
      }
    }

    // If still empty and text is plain, treat entire text as CONTENT.
    if (!role && !speech && !content && !format && !rules && t.trim()) {
      content = t.trim();
    }

    // Ensure rules fallback
    if (!rules.trim()) {
      rules = _stripHeader(FIXED_RULES, "RULES:");
    }

    return {
      role: (role || "").toString().trimEnd(),
      speech: (speech || "").toString().trimEnd(),
      content: (content || "").toString().trimEnd(),
      format: (format || "").toString().trimEnd(),
      rules: (rules || "").toString().trimEnd(),
    };
  }

  function composeInstructionCanonical(sections) {
    const s = sections || {};
    const role = (s.role || "").toString().trimEnd();
    const speech = (s.speech || "").toString().trimEnd();
    const content = (s.content || "").toString().trimEnd();
    const format = (s.format || "").toString().trimEnd();
    const rules = ((s.rules || "").toString().trimEnd()) || _stripHeader(FIXED_RULES, "RULES:");

    // Always keep headers even if section is empty.
    return (
`ROLE:
${role}
---
SPEECH:
${speech}
---
CONTENT:
${content}
---
FORMAT:
${format}
---
RULES:
${rules}`.trimEnd()
    );
  }

  function normalizeInstructionText(raw, fallbackText) {
    const rawText = (raw || "").toString().replace(/\r/g, "").trim();
    const fbText = (fallbackText || "").toString().replace(/\r/g, "").trim();

    const fb = parseInstructionSectionsAny(fbText);
    if (!rawText) {
      // If user cleared everything, keep fallback structure (do not wipe sections).
      return composeInstructionCanonical(fb);
    }

    if (!_hasAnyHeader(rawText)) {
      // Plain paste: route into CONTENT; keep other sections from fallback.
      const next = { ...fb, content: rawText };
      return composeInstructionCanonical(next);
    }

    // Header-based paste: parse and fill missing from fallback.
    const cur = parseInstructionSectionsAny(rawText);
    const next = {
      role: cur.role.trim() ? cur.role : fb.role,
      speech: cur.speech.trim() ? cur.speech : fb.speech,
      content: cur.content.trim() ? cur.content : fb.content,
      format: cur.format.trim() ? cur.format : fb.format,
      rules: cur.rules.trim() ? cur.rules : fb.rules,
    };
    return composeInstructionCanonical(next);
  }

  function profileArr(p, key, legacyKey) {
    const v = p?.[key];
    if (Array.isArray(v)) return v;
    const l = legacyKey ? p?.[legacyKey] : null;
    if (Array.isArray(l)) return l;
    return [];
  }

  function _toLines(blockText) {
    const raw = (blockText || "").toString().replace(/\r/g, "");
    const lines = raw ? raw.split("\n").map((s) => (s ?? "").toString().trimEnd()) : [];
    // Drop leading/trailing empty lines, keep intentional blank lines inside.
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines;
  }

  function _stripLegacyProfileKeys(p) {
    if (!p || typeof p !== "object") return p;

    // If a profile only has legacy keys, convert them into canonical arrays BEFORE removing them.
    const hasCanonical =
      Array.isArray(p.role) || Array.isArray(p.speech) || Array.isArray(p.content) || Array.isArray(p.format) || Array.isArray(p.rules);

    if (!hasCanonical) {
      if (!Array.isArray(p.speech) && Array.isArray(p.speechBehavior) && p.speechBehavior.length) {
        p.speech = [...p.speechBehavior];
      }
      if (Array.isArray(p.contentInstructions) && p.contentInstructions.length) {
        const joined = p.contentInstructions.join("\n");
const sections = parseInstructionSectionsAny(joined);
        // Best-effort mapping: prefer explicit sections if present; otherwise treat as CONTENT.
        p.role = _toLines(sections.role);
        p.speech = _toLines(sections.speech) || (Array.isArray(p.speech) ? p.speech : []);
        p.content = _toLines(sections.content);
        p.format = _toLines(sections.format);
        p.rules = _toLines(sections.rules || _stripHeader(FIXED_RULES, "RULES:"));
      }
    }

    // Remove legacy keys that cause the UI to render SPEECH BEHAVIOR / CONTENT INSTRUCTIONS blocks.
    if ("speechBehavior" in p) delete p.speechBehavior;
    if ("contentInstructions" in p) delete p.contentInstructions;
    return p;
  }


  function _canonicalizeProfileFromText(p, textValue) {
    const sections = parseInstructionSectionsAny(textValue || "");
    p.role = _toLines(sections.role);
    p.speech = _toLines(sections.speech);
    p.content = _toLines(sections.content);
    p.format = _toLines(sections.format);
    p.rules = _toLines(sections.rules || _stripHeader(FIXED_RULES, "RULES:"));
    _stripLegacyProfileKeys(p);
    return p;
  }

  function _sanitizeProfilesCache(profiles) {
    if (!profiles) return profiles;
    const styles = Array.isArray(profiles.styles) ? profiles.styles : [];
    const domains = Array.isArray(profiles.domains) ? profiles.domains : [];
    for (const p of styles) _stripLegacyProfileKeys(p);
    for (const p of domains) _stripLegacyProfileKeys(p);
    return profiles;
  }

  function profileToCanonicalText(profile) {
    const p = profile || {};
    // Canonical storage only (ROLE/SPEECH/CONTENT/FORMAT/RULES). We intentionally ignore legacy
    // keys (speechBehavior/contentInstructions) to prevent the UI from re-inserting them.
    const role = profileArr(p, "role", null).join("\n").trim();
    const speech = profileArr(p, "speech", null).join("\n").trim();
    const content = profileArr(p, "content", null).join("\n").trim();
    const format = profileArr(p, "format", null).join("\n").trim();
    const rules = profileArr(p, "rules", null).join("\n").trim();

    return composeInstructionCanonical({
      role,
      speech,
      content,
      format,
      rules: rules || _stripHeader(FIXED_RULES, "RULES:")
    });
  }
  function applyStyleProfile(profile) {
    const current = (instrCurrentEl?.value || "").toString();

// Canonical sections path (ROLE/SPEECH/CONTENT/FORMAT/RULES) + legacy-compatible profile fields.
// If current text already has canonical headers OR profile uses canonical arrays, prefer canonical update.
const profileHasCanonical = Array.isArray(profile?.role) || Array.isArray(profile?.speech) || Array.isArray(profile?.content) || Array.isArray(profile?.format) || Array.isArray(profile?.rules);
const currentLooksCanonical = /(^|\n)(ROLE:|SPEECH:|CONTENT:|FORMAT:)\s*/.test(current);
if (profileHasCanonical || currentLooksCanonical) {
  const fb = parseInstructionSectionsAny(current);
  const next = {
    role: fb.role,
    speech: (profileArr(profile, "speech", null).join("\n").trim()) || fb.speech,
    content: fb.content,
    format: (profileArr(profile, "format", null).join("\n").trim()) || fb.format,
    rules: fb.rules,
  };
  const canonical = composeInstructionCanonical(next);
  if (instrCurrentEl) instrCurrentEl.value = canonical;
  if (instrStatusEl) instrStatusEl.textContent = "Applied (style → SPEECH/FORMAT)";
  updateVoiceInstructionsUI();
  return;
}
    const speech = (profile.speechBehavior ?? []).join("\n").trim();
    const styleContent = (profile.contentInstructions ?? []).join("\n").trim();
    const domainBlock = extractDomainBlock(current);
    const rulesBlock = extractRulesBlock(current);
    const next =
`SPEECH BEHAVIOR:
${speech}
---
CONTENT INSTRUCTIONS:
${styleContent}${domainBlock ? "\n---\n" + domainBlock : ""}
---
${rulesBlock}`;
    if (instrCurrentEl) instrCurrentEl.value = next;
  }
  function applyDomainProfile(profile) {
    const current = (instrCurrentEl?.value || "").toString();

// Canonical sections path (ROLE/SPEECH/CONTENT/FORMAT/RULES) + legacy-compatible profile fields.
const profileHasCanonical = Array.isArray(profile?.role) || Array.isArray(profile?.speech) || Array.isArray(profile?.content) || Array.isArray(profile?.format) || Array.isArray(profile?.rules);
const currentLooksCanonical = /(^|\n)(ROLE:|SPEECH:|CONTENT:|FORMAT:)\s*/.test(current);
if (profileHasCanonical || currentLooksCanonical) {
  const fb = parseInstructionSectionsAny(current);
  const next = {
    role: (profileArr(profile, "role", null).join("\n").trim()) || fb.role,
    speech: fb.speech,
    content: (profileArr(profile, "content", null).join("\n").trim()) || fb.content,
    format: fb.format,
    rules: (profileArr(profile, "rules", null).join("\n").trim()) || fb.rules,
  };
  const canonical = composeInstructionCanonical(next);
  if (instrCurrentEl) instrCurrentEl.value = canonical;
  if (instrStatusEl) instrStatusEl.textContent = "Applied (domain → ROLE/CONTENT)";
  updateVoiceInstructionsUI();
  return;
}
    const parts = current.split("\n---\n");
    const rulesBlock = extractRulesBlock(current);
    const speechBlock = parts.find((b) => b.startsWith("SPEECH BEHAVIOR:")) ?? "SPEECH BEHAVIOR:\n";
    const styleBlock = parts.find((b, idx) => idx === 1 && b.startsWith("CONTENT INSTRUCTIONS:")) ?? "CONTENT INSTRUCTIONS:\n";
    const domain =
`CONTENT INSTRUCTIONS:
${(profile.contentInstructions ?? []).join("\n").trim()}`;
    const next =
`${speechBlock}
---
${styleBlock}
---
${domain}
---
${rulesBlock}`;
    if (instrCurrentEl) instrCurrentEl.value = next;
  }
  
  // ------------------------------
  // Local persistence for Instruction Profiles (Option B)
  // Stored under: .electron-userdata/instruction_profiles.local.json
  // ------------------------------
  function formatStyleProfile(p) {
    return `SPEECH BEHAVIOR:\n${(p.speechBehavior ?? []).join("\n")}\n\nCONTENT INSTRUCTIONS:\n${(p.contentInstructions ?? []).join("\n")}`.trim();
  }
  function formatDomainProfile(p) {
    return `CONTENT INSTRUCTIONS:\n${(p.contentInstructions ?? []).join("\n")}`.trim();
  }
  function parseStyleProfileText(text) {
    const t = (text || "").toString().replace(/\r/g, "");
    const speechHdr = "SPEECH BEHAVIOR:";
    const contentHdr = "CONTENT INSTRUCTIONS:";
    const iSpeech = t.indexOf(speechHdr);
    const iContent = t.indexOf(contentHdr);
    let speechPart = "";
    let contentPart = "";
    if (iSpeech >= 0 && iContent > iSpeech) {
      speechPart = t.slice(iSpeech + speechHdr.length, iContent).trim();
      contentPart = t.slice(iContent + contentHdr.length).trim();
    } else if (iContent >= 0) {
      // No speech header; treat everything after CONTENT INSTRUCTIONS as content.
      contentPart = t.slice(iContent + contentHdr.length).trim();
    } else {
      // No headers; treat whole text as content.
      contentPart = t.trim();
    }
    const speechBehavior = speechPart ? speechPart.split("\n").map((s) => s.trimEnd()) : [];
    const contentInstructions = contentPart ? contentPart.split("\n").map((s) => s.trimEnd()) : [];
    // Drop leading/trailing empty lines but keep intentional blank lines inside.
    while (speechBehavior.length && !speechBehavior[0].trim()) speechBehavior.shift();
    while (speechBehavior.length && !speechBehavior[speechBehavior.length - 1].trim()) speechBehavior.pop();
    while (contentInstructions.length && !contentInstructions[0].trim()) contentInstructions.shift();
    while (contentInstructions.length && !contentInstructions[contentInstructions.length - 1].trim()) contentInstructions.pop();
    return { speechBehavior, contentInstructions };
  }
  function parseDomainProfileText(text) {
    const t = (text || "").toString().replace(/\r/g, "");
    const hdr = "CONTENT INSTRUCTIONS:";
    const i = t.indexOf(hdr);
    const contentPart = (i >= 0 ? t.slice(i + hdr.length) : t).trim();
    const contentInstructions = contentPart ? contentPart.split("\n").map((s) => s.trimEnd()) : [];
    while (contentInstructions.length && !contentInstructions[0].trim()) contentInstructions.shift();
    while (contentInstructions.length && !contentInstructions[contentInstructions.length - 1].trim()) contentInstructions.pop();
    return { contentInstructions };
  }
  async function saveProfilesToLocal() {
    if (!profilesCache) return false;
    if (!window.electronAPI?.instructionProfilesWrite) return false;
    const payload = {
      version: profilesCache.version || 1,
      updatedAt: new Date().toISOString(),
      styles: Array.isArray(profilesCache.styles) ? profilesCache.styles : [],
      domains: Array.isArray(profilesCache.domains) ? profilesCache.domains : [],
    };

    _sanitizeProfilesCache(payload);
    try {
      await window.electronAPI.instructionProfilesWrite(payload);
      if (profilesErrorEl) profilesErrorEl.textContent = "";
      push("Instruction profiles saved locally");
      return true;
    } catch (e) {
      if (profilesErrorEl) profilesErrorEl.textContent = "Local save failed (instruction_profiles.local.json)";
      push("WARN: instruction profiles local save failed");
      return false;
    }
  }

  function renderProfiles(profiles) {
    if (!profilesStylesEl || !profilesDomainsEl) return;
    profilesStylesEl.innerHTML = "";
    profilesDomainsEl.innerHTML = "";
    const styles = Array.isArray(profiles.styles) ? profiles.styles : [];
    const domains = Array.isArray(profiles.domains) ? profiles.domains : [];
    let styleSeq = 0;
    let domainSeq = 0;
    for (const p of styles) {
      const card = document.createElement("div");
      card.className = "card";
      const title = document.createElement("strong");
      title.textContent = p.name || p.id || "Style";
      // UI-only: simplify titles (avoid long profile names).
      styleSeq += 1;
      title.textContent = `Instruction ${styleSeq}`;
      card.appendChild(title);
      const desc = document.createElement("div");
      desc.textContent = p.description || "";
      card.appendChild(desc);
      const ta = document.createElement("textarea");
      ta.readOnly = false;
      ta.rows = 8;
      ta.value =
`SPEECH BEHAVIOR:
${(p.speechBehavior ?? []).join("\n")}
CONTENT INSTRUCTIONS:
${(p.contentInstructions ?? []).join("\n")}`;
      // UI: show canonical sections (ROLE/SPEECH/CONTENT/FORMAT/RULES) instead of legacy headers.
      ta.value = profileToCanonicalText(p);
      // If profile uses canonical sections (role/speech/content/format/rules), show canonical text in the editor.
      const _hasCanonicalProfile = Array.isArray(p?.role) || Array.isArray(p?.speech) || Array.isArray(p?.content) || Array.isArray(p?.format) || Array.isArray(p?.rules);
      if (_hasCanonicalProfile) {
        ta.value = profileToCanonicalText(p);
      }
      card.appendChild(ta);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Apply";
      btn.addEventListener("click", () => {
        applyStyleProfile(p);
        // Apply should take effect immediately for the next turn.
// Apply should take effect immediately for the next turn.
instructionStore = instructionStore || normalizeStore(null);
instructionStore.realtime = instructionStore.realtime || emptyInstrDoc();
instructionStore.realtime.current = (instrCurrentEl?.value || "").toString();
instructionStore.realtime.updatedAt = new Date().toISOString();
instructionStore.realtime.source = "ui-apply";
updateVoiceInstructionsUI();
      });
      card.appendChild(btn);

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.textContent = "Save";
      btnSave.disabled = true;
      ta.addEventListener("input", () => { btnSave.disabled = false; });
      btnSave.addEventListener("click", async () => {
        // Save in canonical storage only. This prevents the editor from re-inserting
        // legacy headers like "SPEECH BEHAVIOR:" / "CONTENT INSTRUCTIONS:".
        _canonicalizeProfileFromText(p, ta.value);
        ta.value = profileToCanonicalText(p);
        profilesCache = profilesCache || profiles;
        btnSave.disabled = true;
        await saveProfilesToLocal();
      });
      card.appendChild(btnSave);

      profilesStylesEl.appendChild(card);
    }
    for (const p of domains) {
      const card = document.createElement("div");
      card.className = "card";
      const title = document.createElement("strong");
      title.textContent = p.name || p.id || "Domain";
      // UI-only: simplify titles (avoid long profile names).
      domainSeq += 1;
      title.textContent = `Instruction ${domainSeq}`;
      card.appendChild(title);
      const desc = document.createElement("div");
      desc.textContent = p.description || "";
      card.appendChild(desc);
      const ta = document.createElement("textarea");
      ta.readOnly = false;
      ta.rows = 8;
      ta.value =
`CONTENT INSTRUCTIONS:
${(p.contentInstructions ?? []).join("\n")}`;
      // UI: show canonical sections (ROLE/SPEECH/CONTENT/FORMAT/RULES) instead of legacy headers.
      ta.value = profileToCanonicalText(p);
      // If profile uses canonical sections (role/speech/content/format/rules), show canonical text in the editor.
      const _hasCanonicalProfile = Array.isArray(p?.role) || Array.isArray(p?.speech) || Array.isArray(p?.content) || Array.isArray(p?.format) || Array.isArray(p?.rules);
      if (_hasCanonicalProfile) {
        ta.value = profileToCanonicalText(p);
      }
      card.appendChild(ta);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Apply";
      btn.addEventListener("click", () => {
        applyDomainProfile(p);
// Apply should take effect immediately for the next turn.
instructionStore = instructionStore || normalizeStore(null);
instructionStore.realtime = instructionStore.realtime || emptyInstrDoc();
instructionStore.realtime.current = (instrCurrentEl?.value || "").toString();
instructionStore.realtime.updatedAt = new Date().toISOString();
instructionStore.realtime.source = "ui-apply";
updateVoiceInstructionsUI();
      });
      card.appendChild(btn);

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.textContent = "Save";
      btnSave.disabled = true;
      ta.addEventListener("input", () => { btnSave.disabled = false; });
      btnSave.addEventListener("click", async () => {
        // Save in canonical storage only (ROLE/SPEECH/CONTENT/FORMAT/RULES).
        _canonicalizeProfileFromText(p, ta.value);
        ta.value = profileToCanonicalText(p);
        profilesCache = profilesCache || profiles;
        btnSave.disabled = true;
        await saveProfilesToLocal();
      });
      card.appendChild(btnSave);

      profilesDomainsEl.appendChild(card);
    }
  }
    async function loadProfilesFromBackend() {
    // 1) Local override (preferred)
    if (window.electronAPI?.instructionProfilesRead) {
      try {
        const local = await window.electronAPI.instructionProfilesRead();
        if (local && (Array.isArray(local.styles) || Array.isArray(local.domains))) {
          _sanitizeProfilesCache(local);
          profilesCache = local;
          renderProfiles(local);
          if (profilesErrorEl) profilesErrorEl.textContent = "";
          push(`Instruction profiles loaded (local${local.updatedAt ? " " + local.updatedAt : ""})`);
          return local;
        }
      } catch {}
    }

    // 2) Backend seed (fallback)
    const { REALTIME_HTTP } = cfg();
    try {
      const r = await fetch(`${REALTIME_HTTP}/instruction_profiles.json?t=${Date.now()}`, { headers: authHeaders() });
      if (!r.ok) {
        if (profilesErrorEl) profilesErrorEl.textContent = `Profiles load failed (HTTP ${r.status}). Check backend serves /instruction_profiles.json`;
        profilesCache = { version: 1, styles: [], domains: [] };
        renderProfiles(profilesCache);
        return profilesCache;
      }
      const data = await r.json();
      _sanitizeProfilesCache(data);
      profilesCache = data;
      renderProfiles(data);
      if (profilesErrorEl) profilesErrorEl.textContent = "";
      push("Instruction profiles loaded (backend)");
      // Seed local for offline use
      try { await window.electronAPI?.instructionProfilesWrite?.(data); } catch {}
      return data;
    } catch (e) {
      if (profilesErrorEl) profilesErrorEl.textContent = "Profiles load failed (network error)";
      profilesCache = { version: 1, styles: [], domains: [] };
      renderProfiles(profilesCache);
      return profilesCache;
    }
  }

  async function saveInstructionsToBackend_LEGACY() {
    const current = (instrCurrentEl?.value || "").toString();
    const defaultText = (instrDefaultEl?.value || "").toString();
    const updatedAt = new Date().toISOString();

    // Desktop/local-first (source of truth)
    if (hasLocalInstructionStore()) {
      const payload = { current, default: defaultToSave, updatedAt, source: "local-save" };
      const ok = await writeLocalInstructions(payload);

      if (ok) {
        applyInstructionsToUi(payload, "Saved (local)", { silent: true });
        if (instrStatusEl) instrStatusEl.textContent = "Saved (local)";
        push("Instructions saved locally");

        // Best-effort backend sync (does NOT overwrite local)
        const sync = await syncInstructionsToBackend(current, { silent: true });
        if (instrStatusEl) {
          instrStatusEl.textContent = sync.ok ? "Saved (local) + synced" : "Saved (local) (sync failed)";
        }
        if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
        return;
      }

      if (instrStatusEl) instrStatusEl.textContent = "Local save failed; trying backend...";
    }

    // Backend fallback (non-Electron / local store unavailable)
    try {
      const { REALTIME_HTTP } = cfg();
      const r = await fetch(`${REALTIME_HTTP}/v1/instructions`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ current }),
      });
      if (!r.ok) {
        if (instrStatusEl) instrStatusEl.textContent = `Save failed (HTTP ${r.status})`;
        return;
      }
      if (instrStatusEl) instrStatusEl.textContent = "Saved (backend)";
      await loadInstructionsFromBackendExplicit({ silent: true });
    } catch {
      if (instrStatusEl) instrStatusEl.textContent = "Save failed (network error)";
    }
  }

  async function resetInstructionsToDefault_LEGACY() {
    // Desktop/local-first: reset CURRENT to DEFAULT in local store; then best-effort sync to backend.
    if (hasLocalInstructionStore()) {
      const data = await loadInstructionsEffective({ silent: true });
      if (!data) {
        if (instrStatusEl) instrStatusEl.textContent = "Reset failed (no instructions loaded)";
        return;
      }
      const updatedAt = new Date().toISOString();
      const payload = {
        current: (data.default || "").toString(),
        default: (data.default || "").toString(),
        updatedAt,
        source: "local-reset",
      };

      const ok = await writeLocalInstructions(payload);
      if (!ok) {
        if (instrStatusEl) instrStatusEl.textContent = "Reset failed (local write)";
        push("WARN: local reset write failed");
        return;
      }

      applyInstructionsToUi(payload, "Reset (local)", { silent: true });
      if (instrStatusEl) instrStatusEl.textContent = "Reset (local)";
      push("Instructions reset to default (local)");

      const sync = await syncInstructionsToBackend(payload.current, { silent: true });
      if (instrStatusEl) {
        instrStatusEl.textContent = sync.ok ? "Reset (local) + synced" : "Reset (local) (sync failed)";
      }
      if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
      return;
    }

    // Browser fallback: use backend reset endpoint
    const { REALTIME_HTTP } = cfg();
    try {
      const r = await fetch(`${REALTIME_HTTP}/v1/instructions/reset`, { method: "POST", headers: authHeaders() });
      if (!r.ok) {
        if (instrStatusEl) instrStatusEl.textContent = `Reset failed (HTTP ${r.status})`;
        return;
      }
      if (instrStatusEl) instrStatusEl.textContent = "Reset done";
      await loadInstructionsFromBackendExplicit({ silent: true });
    } catch {
      if (instrStatusEl) instrStatusEl.textContent = "Reset failed (network error)";
    }
  }

  async function refreshInstructionsPage_LEGACY() {
    const { REALTIME_HTTP } = cfg();
    if (instrBackendEl) instrBackendEl.textContent = REALTIME_HTTP;
    // Always refresh current instructions when page is opened
    await loadInstructionsEffective({ silent: true });
    setProfilesUiEnabled(false);
  }
  // ------------------------------
  // UI wiring (Settings page)
  // ------------------------------
  function markSettingsSaved(msg) {
    if (!settingsSaved) return;
    settingsSaved.textContent = msg || "Saved";
    window.setTimeout(() => {
      try { settingsSaved.textContent = ""; } catch {}
    }, 1500);
  }
  function saveSettingsFromInputs() {
    saveStrLS(LS_STT_BASE, $("sttBase").value.trim());
    saveStrLS(LS_ORCH_HTTP, $("orchHttp").value.trim());
    saveStrLS(LS_CONTROL_BASE, $("controlBase").value.trim());
    saveStrLS(LS_RT_HTTP, $("rtHttp").value.trim());
    saveStrLS(LS_RT_WS, $("rtWs").value.trim());
saveStrLS(LS_VOICE_ENGINE, normalizeVoiceEngine((voiceEngineEl?.value || "").toString()));
saveStrLS(LS_REALTIME_RATE, normalizeRealtimeRate((realtimeRateEl?.value || "").toString()));
applyVoiceEngineUiState(getVoiceEngine());
markSettingsSaved("Saved");
  }
  function resetSettingsToDefaults() {
    saveStrLS(LS_STT_BASE, "");
    saveStrLS(LS_ORCH_HTTP, "");
    saveStrLS(LS_CONTROL_BASE, "");
    saveStrLS(LS_RT_HTTP, "");
    saveStrLS(LS_RT_WS, "");
    saveStrLS(LS_VOICE_ENGINE, "");
    saveStrLS(LS_REALTIME_RATE, "");
    loadEndpointSettingsIntoInputs();
    loadVoiceSettingsIntoInputs();
    markSettingsSaved("Reset to defaults");
  }
  function applyLocalBackendPreset() {
    $("sttBase").value = LOCAL_BACKEND_PRESET.STT_WS_BASE;
    $("orchHttp").value = LOCAL_BACKEND_PRESET.ORCH_HTTP;
    $("controlBase").value = LOCAL_BACKEND_PRESET.ORCH_CONTROL_WS_BASE;
    $("rtHttp").value = LOCAL_BACKEND_PRESET.REALTIME_HTTP;
    $("rtWs").value = LOCAL_BACKEND_PRESET.REALTIME_WS;
    push("Local backend endpoint preset applied. Click Save settings.");
  }
  if (btnUseLocalBackend) btnUseLocalBackend.addEventListener("click", () => {
    applyLocalBackendPreset();
  });
  if (btnSaveSettings) btnSaveSettings.addEventListener("click", () => {
    saveSettingsFromInputs();
    // Keep Instructions page backend label consistent if user changed REALTIME_HTTP
    try { refreshInstructionsPage().catch(() => {}); } catch {}
  });
  if (btnResetSettings) btnResetSettings.addEventListener("click", () => {
    resetSettingsToDefaults();
    try { refreshInstructionsPage().catch(() => {}); } catch {}
  });
  if (sttEnabledEl) {
    sttEnabledEl.addEventListener("change", async () => {
      const enabled = getSttEnabled();
      saveBoolLS(LS_STT_ENABLED, enabled);
      push(`STT Enabled set to: ${enabled ? "ON" : "OFF"}`);
      if (!enabled && sttWs) {
        await stopStt();
      }
      refreshButtons();
    });
  }
  if (sttLangEl) {
    sttLangEl.addEventListener("change", () => {
      const lang = getSttLanguage();
      saveStrLS(LS_STT_LANGUAGE, lang);
      push(`STT language set to: ${lang} (will apply on next STT start)`);
    });
  }
// Voice engine + rate (Paket 1)
async function reconnectVoiceWs(reason) {
  if (!desiredConnected) return;
  try {
    rtReconnectSuppressOnce = true;
    try { rtWs?.close(1000, reason || "reconfigure"); } catch {}
    rtWs = null;
    // Connect immediately with the new config.
    await connectRealtime();
    refreshButtons();
  } catch (e) {
    push(`WARN: voice WS reconnect failed: ${e?.message || e}`);
  }
}

if (voiceEngineEl) {
  voiceEngineEl.addEventListener("change", async () => {
    if ((directRealtimeActive || directRealtimeStarting) && normalizeVoiceEngine(voiceEngineEl.value) !== "realtime") {
      try { voiceEngineEl.value = "realtime"; } catch {}
      try { if (voiceEngineVoiceEl) voiceEngineVoiceEl.value = "realtime"; } catch {}
      saveStrLS(LS_VOICE_ENGINE, "realtime");
      push("Direct Realtime requires Voice Engine = realtime.");
      return;
    }
    // Keep Voice tab selector in sync
    try { if (voiceEngineVoiceEl) voiceEngineVoiceEl.value = voiceEngineEl.value; } catch {}
    const engine = getVoiceEngine();
    saveStrLS(LS_VOICE_ENGINE, engine);
    applyVoiceEngineUiState(engine);
    push(`Voice Engine set to: ${engine}${engine === "realtime" ? " (rate applies)" : ""}`);
    await reconnectVoiceWs("engine-change");
    updateVoiceInstructionsUI();
  });
}
if (voiceEngineVoiceEl) {
  voiceEngineVoiceEl.addEventListener("change", async () => {
    if ((directRealtimeActive || directRealtimeStarting) && normalizeVoiceEngine(voiceEngineVoiceEl.value) !== "realtime") {
      try { voiceEngineVoiceEl.value = "realtime"; } catch {}
      try { if (voiceEngineEl) voiceEngineEl.value = "realtime"; } catch {}
      saveStrLS(LS_VOICE_ENGINE, "realtime");
      push("Direct Realtime requires Voice Engine = realtime.");
      return;
    }
    // Sync Settings selector
    try { if (voiceEngineEl) voiceEngineEl.value = voiceEngineVoiceEl.value; } catch {}
    const engine = getVoiceEngine();
    saveStrLS(LS_VOICE_ENGINE, engine);
    applyVoiceEngineUiState(engine);
    push(`Voice Engine set to: ${engine}${engine === "realtime" ? " (rate applies)" : ""}`);
    await reconnectVoiceWs("engine-change");
    updateVoiceInstructionsUI();
    // Update status label immediately (even if disconnected)
    setRealtimeStatus(desiredConnected ? "RECONNECTING" : "OFF");
  });
}
if (realtimeRateEl) {
  realtimeRateEl.addEventListener("change", async () => {
    // Keep Voice tab selector in sync
    try { if (realtimeRateVoiceEl) realtimeRateVoiceEl.value = realtimeRateEl.value; } catch {}
    const rate = getRealtimeRate();
    saveStrLS(LS_REALTIME_RATE, rate);
    if (directRealtimeActive || directRealtimeStarting) {
      push("Realtime rate change will apply after Direct Realtime restart.");
      return;
    }
    push(`Realtime rate set to: ${rate} (will apply immediately if connected)`);
    if (getVoiceEngine() === "realtime") await reconnectVoiceWs("rate-change");
  });
}
if (realtimeRateVoiceEl) {
  realtimeRateVoiceEl.addEventListener("change", async () => {
    // Sync Settings selector
    try { if (realtimeRateEl) realtimeRateEl.value = realtimeRateVoiceEl.value; } catch {}
    const rate = getRealtimeRate();
    saveStrLS(LS_REALTIME_RATE, rate);
    if (directRealtimeActive || directRealtimeStarting) {
      push("Realtime rate change will apply after Direct Realtime restart.");
      return;
    }
    push(`Realtime rate set to: ${rate} (will apply immediately if connected)`);
    if (getVoiceEngine() === "realtime") await reconnectVoiceWs("rate-change");
  });
}
if (playbackVolumeEl) {
  playbackVolumeEl.addEventListener("input", () => {
    applyPlaybackVolume(playbackVolumeEl.value);
  });
}

  // Auth token UI
  function setAuthStatus() {
    if (!authStatusEl) return;
    const token = getAuthToken();
    authStatusEl.textContent = token ? "Token set" : "No token";
  }
  if (btnSaveToken) btnSaveToken.addEventListener("click", () => {
    const token = (authTokenEl?.value || "").trim();
    saveStrLS(LS_AUTH_TOKEN, token);
    setAuthStatus();
    push(token ? "Auth token saved (will be used for API calls)" : "Auth token cleared");
  });
  if (btnClearToken) btnClearToken.addEventListener("click", () => {
    saveStrLS(LS_AUTH_TOKEN, "");
    if (authTokenEl) authTokenEl.value = "";
    setAuthStatus();
    push("Auth token cleared");
  });
  // ------------------------------

  // ------------------------------
  // Pause/buffer UI is disabled for Direct Realtime no-buffer playback.
  // ------------------------------
  function initPauseUi() {
    btnPauseAudio = null;
    pauseInfoEl = null;
  }

  initPauseUi();
  // UI wiring (Voice page)
  // ------------------------------
  $("btnRefreshDevices").addEventListener("click", async () => {
    await refreshOutputDevicesUI();
    await applyRealtimeSink();
  });
  rtDeviceSel.addEventListener("change", async () => {
    const outputs = await enumerateAudioOutputs();
    const deviceId = (rtDeviceSel.value || "").trim();
    const label =
      outputs.find((d) => d.deviceId === deviceId)?.label ||
      rtDeviceSel.options[rtDeviceSel.selectedIndex]?.textContent ||
      "";
    if (REALTIME_HEADPHONES_ONLY && deviceId && !isHeadphonesLabel(label)) {
      push(`Realtime sink policy: headphones-only. Cannot select: ${label || deviceId}`);
      rtDeviceSel.value = "";
    } else {
      saveRtDeviceSelection(deviceId, label);
    }
    await applyRealtimeSink();
  });
  $("btnConnect").addEventListener("click", async () => {
    await prepareRealtimeSocketForDirect();
    desiredConnected = true;
    clearReconnectTimers();
    await refreshOutputDevicesUI();
    await connectRealtime();
    await loadInstructionsEffective();
    refreshButtons();
  });
  $("btnReloadInstr").addEventListener("click", async () => {
    await loadInstructionsEffective();
  });
  $("btnStart").addEventListener("click", async () => {
    try {
      await startDirectRealtime();
    } catch (e) {
      push(`ERROR(Direct Realtime start): ${e?.message || e}`);
    }
  });
  $("btnStop").addEventListener("click", async () => {
    if (directRealtimeActive || directRealtimeStarting || directStream || directCtx) {
      await stopDirectRealtime();
    } else {
      await stopLegacySttCaptureOnly("manual-stop");
      setDirectStatusOn(false);
      refreshButtons();
    }
  });
  if (btnTestFullPipeline) {
    btnTestFullPipeline.addEventListener("click", () => {
      push("Test Direct Pipeline is not implemented yet.");
    });
  }
  if (btnResetSession) {
    btnResetSession.addEventListener("click", async () => {
      try {
        await resetSessionToReady();
      } catch (e) {
        push(`ERROR(reset session): ${e?.message || e}`);
      }
    });
  }
  if (navigator?.mediaDevices) {
    try {
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    } catch {
      navigator.mediaDevices.ondevicechange = onDeviceChange;
    }
  }
  window.addEventListener("beforeunload", () => {
    desiredConnected = false;
    clearReconnectTimers();
    clearPingTimers();
    clearFullPipelineTestTimer();
    try { stopDirectRealtime({ closeRealtime: false, silent: true }); } catch {}
    try { controlWs?.close(1000, "reset"); } catch {}
    try { rtWs?.close(1000, "reset"); } catch {}
    try { sttWs?.close(1000, "stop"); } catch {}
    try { fullPipelineTestWs?.close(1000, "window unload"); } catch {}
    controlWs = null;
    rtWs = null;
    rtWsEngine = "";
    sttWs = null;
    fullPipelineTestWs = null;
    try {
      if (navigator?.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      }
    } catch {}
  });
  // Initial UI state
  setDirectStatusOn(false);
  setControlStatus("OFF");
  setRealtimeStatus("OFF");
  (async () => {
    try {
      await refreshOutputDevicesUI();
      await applyRealtimeSink();
      await loadInstructionsEffective({ silent: true });
    } catch {}
    refreshButtons();
  })();
  push("Ready. Click Start Direct Realtime to stream loopback/system audio to /voice/ws.");
})();
