/* global electronAPI */
(function () {
  const DEFAULTS = {
    REALTIME_HTTP: "http://127.0.0.1:50505",
    REALTIME_WS: "ws://127.0.0.1:50505/voice/ws",
  };
  const LOCAL_BACKEND_PRESET = {
    REALTIME_HTTP: "http://127.0.0.1:50505",
    REALTIME_WS: "ws://127.0.0.1:50505/voice/ws",
  };
  // Persisted settings
  const LS_RT_DEVICE_ID = "chatt.rtOutputDeviceId";
  const LS_RT_DEVICE_LABEL = "chatt.rtOutputDeviceLabel";
  const LS_RT_DEVICE_PREFERRED_LABEL = "chatt.rtPreferredDeviceLabel";
  const LS_AUDIO_SAFETY_RECORD = "chatt.audioSafety.record";
  // Endpoints (settings page)
  const LS_RT_HTTP = "chatt.settings.rtHttp";
  const LS_RT_WS = "chatt.settings.rtWs";
  // Auth (optional)
  const LS_AUTH_TOKEN = "chatt.auth.bearerToken";
const LS_REALTIME_RATE = "chatt.realtime.rate";
const LS_PLAYBACK_VOLUME = "chatt.realtime.playbackVolume";
const LS_INSTR_TARGET = "chatt.instructions.target"; // Direct Instructions target; always "realtime"
const LS_INSTRUCTION_PRESET = "chatt.instructions.preset";
const LS_DISPLAY_LANGUAGE = "chatt.displayLanguage";
const LS_IDLE_GUARD_MINUTES = "chatt.costGuard.idleMinutes";
const LS_IDLE_GUARD_WARN = "chatt.costGuard.warnBeforeStop";
const LS_MAX_SESSION_MINUTES = "chatt.costGuard.maxSessionMinutes";
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
  const voiceActivityLines = [];
  let logFilter = "";
  let logAutoscroll = true;
  function renderVoiceActivityLine(line) {
    const el = $("voiceActivityList");
    if (!el) return;
    voiceActivityLines.push(line);
    while (voiceActivityLines.length > 5) voiceActivityLines.shift();
    el.innerHTML = "";
    for (const item of voiceActivityLines) {
      const div = document.createElement("div");
      div.className = "activityItem";
      div.textContent = item;
      el.appendChild(div);
    }
  }
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
    renderVoiceActivityLine(line);
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
  let activityListeningActive = false;
  let activitySpeakingActive = false;
  function setPillElement(el, state, text) {
    if (!el) return;
    el.classList.remove("ok", "warn", "bad");
    el.classList.add(state);
    el.textContent = text;
  }
  function setPill(id, state, text) {
    setPillElement($(id), state, text);
  }
  function setSettingsBadge(el, state, text) {
    setPillElement(el, state, text);
  }
  function getRealtimeHttpHost() {
    const raw = ($("rtHttp")?.value || DEFAULTS.REALTIME_HTTP).toString().trim();
    try {
      return new URL(raw).host || "127.0.0.1:50505";
    } catch {
      return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "") || "127.0.0.1:50505";
    }
  }
  function updateEndpointSummaryUi() {
    const httpHost = getRealtimeHttpHost();
    const wsRaw = ($("rtWs")?.value || DEFAULTS.REALTIME_WS).toString().trim();
    let wsPath = "/voice/ws";
    try { wsPath = new URL(wsRaw).pathname || "/voice/ws"; } catch {}
    if (bottomBackendEl) bottomBackendEl.textContent = httpHost;
    if (bottomWsEl) bottomWsEl.textContent = wsPath;
    if (settingsDiagBackendEl) settingsDiagBackendEl.textContent = httpHost;
    if (settingsConnectionBadgeEl) setSettingsBadge(settingsConnectionBadgeEl, "ok", t("common.ready", "Ready"));
    if (headerBackendStatusEl && (!document.body.dataset.session || document.body.dataset.session === "off")) {
      headerBackendStatusEl.textContent = httpHost;
    }
  }
  function updateSettingsWsStatus(state) {
    if (!settingsDiagWsEl) return;
    if (state === "ON") settingsDiagWsEl.textContent = t("common.connected", "Connected");
    else if (state === "RECONNECTING") settingsDiagWsEl.textContent = t("common.reconnecting", "Reconnecting");
    else settingsDiagWsEl.textContent = t("common.ready", "Ready");
  }
  function setSessionStatus(state) {
    const normalized = state === "ON" || state === "STARTING" || state === "RECONNECTING" ? state : "OFF";
    const text = `${t("status.sessionPrefix", "Session")}: ${normalized}`;
    const pillState = normalized === "ON" ? "ok" : normalized === "OFF" ? "bad" : "warn";
    setPillElement(sessionStatusEl, pillState, text);
    if (voiceStatusSessionEl) voiceStatusSessionEl.textContent = normalized;
    if (headerBackendStatusEl) {
      const host = getRealtimeHttpHost();
      headerBackendStatusEl.textContent =
        normalized === "ON" ? `Connected ${host}` :
        normalized === "STARTING" ? `Starting ${host}` :
        normalized === "RECONNECTING" ? `Reconnecting ${host}` :
        host;
    }
    try { document.body.dataset.session = normalized.toLowerCase(); } catch {}
    publishMiniControlStatus();
  }
  function updateActivityStatus() {
    const activity = activitySpeakingActive ? "Speaking" : activityListeningActive ? "Listening" : "Idle";
    const activityText =
      activity === "Speaking" ? t("status.activitySpeaking", "Speaking") :
      activity === "Listening" ? t("status.activityListening", "Listening") :
      t("status.activityIdle", "Idle");
    setPillElement(activityStatusEl, activity === "Idle" ? "warn" : "ok", `${t("status.activityPrefix", "Activity")}: ${activityText}`);
    if (voiceStatusActivityEl) voiceStatusActivityEl.textContent = activityText;
    try { document.body.dataset.activity = activity.toLowerCase(); } catch {}
    publishMiniControlStatus();
  }

  function readMiniControlButtonDisabled(id) {
    const btn = document.getElementById(id);
    return !!(btn && btn.disabled);
  }

  function buildMiniControlStatus() {
    const sessionEl = document.getElementById("sessionStatus");
    const activityEl = document.getElementById("activityStatus");

    return {
      session: document.body?.dataset?.session || "off",
      activity: document.body?.dataset?.activity || "idle",
      sessionText: sessionEl?.textContent || "Session: OFF",
      activityText: activityEl?.textContent || "Activity: Idle",
      buttons: {
        startDisabled: readMiniControlButtonDisabled("btnStart"),
        stopDisabled: readMiniControlButtonDisabled("btnStop"),
        refreshDisabled: readMiniControlButtonDisabled("btnInstrRefresh"),
        repeatDisabled: readMiniControlButtonDisabled("btnRepeatLastAnswer"),
        resetDisabled: readMiniControlButtonDisabled("btnResetSession"),
      },
    };
  }

  function publishMiniControlStatus() {
    try {
      const api = window.electronAPI && window.electronAPI.miniControl;
      if (!api || typeof api.publishStatus !== "function") return;
      api.publishStatus(buildMiniControlStatus()).catch(() => {});
    } catch (_) {
      // ignore
    }
  }

  function setListeningIndicator(active) {
    activityListeningActive = !!active;
    if (listenStatusEl && active) {
      listenStatusEl.classList.remove("bad");
      listenStatusEl.classList.add("ok");
    } else if (listenStatusEl) {
      listenStatusEl.classList.remove("ok");
      listenStatusEl.classList.add("bad");
    }
    updateActivityStatus();
  }
  function setSpeakingIndicator(active) {
    activitySpeakingActive = !!active;
    if (speakStatusEl && active) {
      speakStatusEl.classList.remove("bad");
      speakStatusEl.classList.add("ok");
    } else if (speakStatusEl) {
      speakStatusEl.classList.remove("ok");
      speakStatusEl.classList.add("bad");
    }
    updateActivityStatus();
  }
  // ------------------------------
  // Navigation (Views)
  // ------------------------------
  const viewVoice = $("viewVoice");
  const viewLicense = $("viewLicense");
  const viewSettings = $("viewSettings");
  const viewInstructions = $("viewInstructions");
  const navVoice = $("navVoice");
  const navLicense = $("navLicense");
  const navSettings = $("navSettings");
  const navInstructions = $("navInstructions");
  // Voice view: instructions preview panel
  const voiceInstrTextEl = $("voiceInstrText");
  const voiceInstrUpdatedAtEl = $("voiceInstrUpdatedAt");
  const voiceScenarioNameEl = $("voiceScenarioName");
  const voiceScenarioDescriptionEl = $("voiceScenarioDescription");
  const headerBackendStatusEl = $("headerBackendStatus");
  const headerProviderSummaryEl = $("headerProviderSummary");
  const voiceStatusSessionEl = $("voiceStatusSession");
  const voiceStatusActivityEl = $("voiceStatusActivity");
  const voiceStatusProviderEl = $("voiceStatusProvider");
  const voiceStatusModelEl = $("voiceStatusModel");
  const voiceStatusVoiceEl = $("voiceStatusVoice");
  const voiceStatusOutputLanguageEl = $("voiceStatusOutputLanguage");
  const bottomBackendEl = $("bottomBackend");
  const bottomWsEl = $("bottomWs");
  const bottomOutputEl = $("bottomOutput");
  const bottomVolumeMirrorEl = $("bottomVolumeMirror");
  const bottomVolumeValueEl = $("bottomVolumeValue");
  const settingsConnectionBadgeEl = $("settingsConnectionBadge");
  const settingsOutputBadgeEl = $("settingsOutputBadge");
  const settingsCostGuardBadgeEl = $("settingsCostGuardBadge");
  const settingsProviderBadgeEl = $("settingsProviderBadge");
  const settingsPlaybackVolumeTextEl = $("settingsPlaybackVolumeText");
  const settingsOutputDeviceTextEl = $("settingsOutputDeviceText");
  const audioSafetyStatusEl = $("audioSafetyStatus");
  const audioSafetyMessageEl = $("audioSafetyMessage");
  const btnTestSelectedOutput = $("btnTestSelectedOutput");
  const btnConfirmHeadphonesOutput = $("btnConfirmHeadphonesOutput");
  const btnResetAudioSafety = $("btnResetAudioSafety");
  const settingsDiagBackendEl = $("settingsDiagBackend");
  const settingsDiagWsEl = $("settingsDiagWs");
  const settingsDiagOutputEl = $("settingsDiagOutput");
  const settingsDiagProviderTestEl = $("settingsDiagProviderTest");
  const btnVoiceCopyInstr = $("btnVoiceCopyInstr");
  const btnVoiceOpenInstr = $("btnVoiceOpenInstr");
  let skipNextLicenseViewRefresh = false;
  function setActiveNav(btn) {
    for (const b of [navVoice, navLicense, navSettings, navInstructions]) {
      if (!b) continue;
      b.classList.toggle("active", b === btn);
    }
  }
  function setActiveView(name) {
    if (viewVoice) viewVoice.classList.toggle("active", name === "voice");
    if (viewLicense) viewLicense.classList.toggle("active", name === "license");
    if (viewSettings) viewSettings.classList.toggle("active", name === "settings");
    if (viewInstructions) viewInstructions.classList.toggle("active", name === "instructions");
    if (name === "voice") { setActiveNav(navVoice); updateVoiceInstructionsUI(); }
    if (name === "license") {
      setActiveNav(navLicense);
      try { renderLicenseState(currentLicenseState || { status: "not_registered" }); } catch {}
      const shouldRefreshLicense = !skipNextLicenseViewRefresh;
      skipNextLicenseViewRefresh = false;
      if (shouldRefreshLicense) {
        try { refreshLicenseState().catch(() => {}); } catch {}
      }
    }
    if (name === "settings") setActiveNav(navSettings);
    if (name === "instructions") setActiveNav(navInstructions);
    if (name === "instructions") {
      // Refresh instructions UI when user opens the page.
      try { refreshInstructionsPage().catch(() => {}); } catch {}
    }
  }
  if (navVoice) navVoice.addEventListener("click", () => setActiveView("voice"));
  if (navLicense) navLicense.addEventListener("click", () => setActiveView("license"));
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
  const sessionStatusEl = $("sessionStatus");
  const activityStatusEl = $("activityStatus");
  const listenStatusEl = $("listenStatus");
  const speakStatusEl = $("speakStatus");
  const realtimeRateEl = $("realtimeRate");
  const realtimeRateVoiceEl = $("realtimeRateVoice");
  const playbackVolumeEl = $("playbackVolume");
  const playbackVolumeValueEl = $("playbackVolumeValue");
  const btnResetSession = $("btnResetSession");
  // Pause/Resume (Voice audio) UI refs (created dynamically)
  let btnPauseAudio = null;
  let pauseInfoEl = null;
  // Settings page elements
  const btnUseLocalBackend = $("btnUseLocalBackend");
  const btnSaveSettings = $("btnSaveSettings");
  const btnResetSettings = $("btnResetSettings");
  const settingsSaved = $("settingsSaved");
  const providerActiveEl = $("providerActive");
  const providerRegionRow = $("providerRegionRow");
  const providerRegionEl = $("providerRegion");
  const providerEndpointRow = $("providerEndpointRow");
  const providerEndpointEl = $("providerEndpoint");
  const providerApiVersionRow = $("providerApiVersionRow");
  const providerApiVersionEl = $("providerApiVersion");
  const providerModelLabelEl = $("providerModelLabel");
  const providerModelEl = $("providerModel");
  const providerVoiceEl = $("providerVoice");
  const providerIncomingLanguageEl = $("providerIncomingLanguage");
  const providerOutgoingLanguageEl = $("providerOutgoingLanguage");
  const providerApiKeyEl = $("providerApiKey");
  const btnProviderTest = $("btnProviderTest");
  const btnProviderSave = $("btnProviderSave");
  const btnProviderReset = $("btnProviderReset");
  const providerStatusEl = $("providerStatus");
  const headerDisplayLanguageEl = $("headerDisplayLanguage");
  const displayLanguageEl = $("displayLanguage");
  const idleGuardMinutesEl = $("idleGuardMinutes");
  const idleGuardWarnEl = $("idleGuardWarn");
  const maxSessionMinutesEl = $("maxSessionMinutes");
  const costGuardNoticeEl = $("costGuardNotice");
  const authTokenEl = $("authToken");
  const btnSaveToken = $("btnSaveToken");
  const btnClearToken = $("btnClearToken");
  const authStatusEl = $("authStatus");
  const settingsUpdateBadgeEl = $("settingsUpdateBadge");
  const settingsUpdateVersionEl = $("settingsUpdateVersion");
  const settingsUpdateStatusEl = $("settingsUpdateStatus");
  const settingsUpdateProgressEl = $("settingsUpdateProgress");
  const btnUpdateCheck = $("btnUpdateCheck");
  const btnUpdateDownload = $("btnUpdateDownload");
  const btnUpdateRestart = $("btnUpdateRestart");
  const settingsLicenseBadgeEl = $("settingsLicenseBadge");
  const licenseStatusEl = $("licenseStatus");
  const licenseRegisteredEmailEl = $("licenseRegisteredEmail");
  const licenseTrialExpiresAtEl = $("licenseTrialExpiresAt");
  const licenseTrialRemainingEl = $("licenseTrialRemaining");
  const licenseLastValidatedAtEl = $("licenseLastValidatedAt");
  const licenseOfflineGraceExpiresAtEl = $("licenseOfflineGraceExpiresAt");
  const licenseEmailEl = $("licenseEmail");
  const licenseKeyEl = $("licenseKey");
  const btnLicenseStartTrial = $("btnLicenseStartTrial");
  const btnLicenseActivate = $("btnLicenseActivate");
  const btnLicenseValidate = $("btnLicenseValidate");
  const btnLicenseCheckout = $("btnLicenseCheckout");
  const licenseMessageEl = $("licenseMessage");
  // Instructions page elements
  const instrBackendEl = $("instrBackend");
  const instrCurrentEl = $("instrCurrent");
  const instrDefaultEl = $("instrDefault");
  const instrUpdatedAtEl = $("instrUpdatedAt");
  const instrSourceEl = $("instrSource");
  const instrStatusEl = $("instrStatus");
  const instructionPresetEl = $("instructionPreset");
  const scenarioCardsEl = $("scenarioCards");
  const scenarioLibraryPreviewEl = $("scenarioLibraryTooltip");
  const scenarioSelectedBadgeEl = $("scenarioSelectedBadge");
  const scenarioOverrideBadgeEl = $("scenarioOverrideBadge");
  const scenarioSelectedNameEl = $("scenarioSelectedName");
  const scenarioSelectedDescriptionEl = $("scenarioSelectedDescription");
  const scenarioActiveStateEl = $("scenarioActiveState");
  const scenarioCustomStateEl = $("scenarioCustomState");
  const scenarioDetailsCategoryEl = $("scenarioDetailsCategory");
  const scenarioDetailsShortEl = $("scenarioDetailsShort");
  const scenarioDetailsUseEl = $("scenarioDetailsUse");
  const scenarioStateActiveEl = $("scenarioStateActive");
  const scenarioStateOverrideEl = $("scenarioStateOverride");
  const scenarioStateRefreshEl = $("scenarioStateRefresh");
  const btnInstrRefreshProxyEls = document.querySelectorAll("[data-instr-refresh-proxy]");
  const btnInstrLoad = $("btnInstrLoad");
  const btnInstrSave = $("btnInstrSave");
  const btnInstrReset = $("btnInstrReset");
  const btnInstrRefresh = $("btnInstrRefresh");
  const btnRepeatLastAnswer = $("btnRepeatLastAnswer");
  const instrTargetEl = $("instrTarget");

  let currentUpdateState = null;
  let currentLicenseState = null;
  let lastUpdateProgressLogPercent = null;

  const SUPPORTED_DISPLAY_LANGUAGES = ["en", "es", "de", "sr"];
  const DEFAULT_DISPLAY_LANGUAGE = "en";
  let localeCatalogs = { ui: {}, scenarios: {} };
  let localeCatalogLoadPromise = null;
  let localeScenarioUiReady = false;

  function normalizeDisplayLanguage(lang) {
    const code = (lang || "").toString().trim().toLowerCase();
    return SUPPORTED_DISPLAY_LANGUAGES.includes(code) ? code : DEFAULT_DISPLAY_LANGUAGE;
  }

  function getDisplayLanguage() {
    return normalizeDisplayLanguage(loadStrLS(LS_DISPLAY_LANGUAGE, DEFAULT_DISPLAY_LANGUAGE));
  }

  function syncDisplayLanguageControls(lang) {
    const next = normalizeDisplayLanguage(lang);
    if (displayLanguageEl) displayLanguageEl.value = next;
    if (headerDisplayLanguageEl) headerDisplayLanguageEl.value = next;
    return next;
  }

  function loadJsonAsset(path) {
    return fetch(path, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(() => new Promise((resolve, reject) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", path, true);
          xhr.overrideMimeType("application/json");
          xhr.onload = () => {
            try {
              if (xhr.status && xhr.status >= 400) throw new Error(`HTTP ${xhr.status}`);
              resolve(JSON.parse(xhr.responseText || "{}"));
            } catch (e) {
              reject(e);
            }
          };
          xhr.onerror = () => reject(new Error("locale load failed"));
          xhr.send();
        } catch (e) {
          reject(e);
        }
      }));
  }

  function loadLocaleCatalogs() {
    if (localeCatalogLoadPromise) return localeCatalogLoadPromise;
    localeCatalogLoadPromise = Promise.all([
      loadJsonAsset("./locales/ui.json"),
      loadJsonAsset("./locales/scenarios.json"),
    ])
      .then(([ui, scenarios]) => {
        localeCatalogs = {
          ui: ui && typeof ui === "object" ? ui : {},
          scenarios: scenarios && typeof scenarios === "object" ? scenarios : {},
        };
        return localeCatalogs;
      })
      .catch((e) => {
        push(`WARN: locale catalog load failed: ${e?.message || e}`);
        localeCatalogs = { ui: {}, scenarios: {} };
        return localeCatalogs;
      });
    return localeCatalogLoadPromise;
  }

  function readUiText(lang, key) {
    const value = localeCatalogs?.ui?.[lang]?.[key];
    return typeof value === "string" && value.trim() ? value : "";
  }

  function t(key, fallback) {
    const k = (key || "").toString().trim();
    const fb = fallback == null ? "" : fallback.toString();
    if (!k) return fb;
    const lang = getDisplayLanguage();
    return readUiText(lang, k) || readUiText(DEFAULT_DISPLAY_LANGUAGE, k) || fb;
  }

  function applyTranslatedText(el, attr, fallbackAttr, setter) {
    const key = (el.getAttribute(attr) || "").toString().trim();
    if (!key) return;
    let fallback = el.getAttribute(fallbackAttr);
    if (fallback == null) {
      fallback = setter === "textContent"
        ? (el.textContent || "").toString()
        : (el.getAttribute(setter) || "").toString();
      el.setAttribute(fallbackAttr, fallback);
    }
    const value = t(key, fallback);
    if (setter === "textContent") el.textContent = value;
    else el.setAttribute(setter, value);
  }

  function applyLocale() {
    const lang = getDisplayLanguage();
    try { document.documentElement.lang = lang; } catch {}
    syncDisplayLanguageControls(lang);
    document.title = `AnswerDesk AI - ${t("app.subtitle", "Realtime Voice")}`;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      applyTranslatedText(el, "data-i18n", "data-i18n-fallback", "textContent");
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      applyTranslatedText(el, "data-i18n-placeholder", "data-i18n-placeholder-fallback", "placeholder");
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      applyTranslatedText(el, "data-i18n-title", "data-i18n-title-fallback", "title");
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      applyTranslatedText(el, "data-i18n-aria-label", "data-i18n-aria-label-fallback", "aria-label");
    });

    if (localeScenarioUiReady) {
      try { renderScenarioPresetDropdown(); } catch {}
      try { updateVoiceScenarioUI(); } catch {}
      try { updateProviderSummaryUi(); } catch {}
      try { updateEndpointSummaryUi(); } catch {}
      try { updateCostGuardSummaryUi(); } catch {}
    }
    try { renderUpdateState(currentUpdateState || { status: "idle" }); } catch {}
    try { renderLicenseState(currentLicenseState || { status: "not_registered" }); } catch {}
  }

  function setDisplayLanguage(lang) {
    const next = normalizeDisplayLanguage(lang);
    saveStrLS(LS_DISPLAY_LANGUAGE, next);
    syncDisplayLanguageControls(next);
    applyLocale();
    loadLocaleCatalogs().then(() => applyLocale()).catch(() => {});
    return next;
  }

  function getUpdateApi() {
    const api = window.electronAPI?.updates;
    if (
      !api ||
      typeof api.getState !== "function" ||
      typeof api.check !== "function" ||
      typeof api.download !== "function" ||
      typeof api.quitAndInstall !== "function"
    ) {
      return null;
    }
    return api;
  }

  function normalizeUpdateStatus(status, type) {
    const raw = (status || type || "idle").toString().trim();
    if (raw === "checking-for-update" || raw === "check-started") return "checking";
    if (raw === "download-progress" || raw === "download-started") return "downloading";
    if (raw === "quit-and-install") return "installing";
    if (raw === "update-available") return "update-available";
    if (raw === "update-not-available") return "update-not-available";
    if (raw === "update-downloaded") return "update-downloaded";
    if (raw === "checking" || raw === "downloading" || raw === "installing" || raw === "error" || raw === "idle") return raw;
    return "idle";
  }

  function normalizeUpdateState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const source = raw.state && typeof raw.state === "object" ? raw.state : raw;
    const payload = raw.payload && typeof raw.payload === "object" ? raw.payload : {};
    const error = source.error || payload.error || raw.error || null;
    const progress = source.progress || payload.progress || null;
    const info = source.info || payload.info || null;
    const status = normalizeUpdateStatus(source.status, raw.type);
    const downloaded = source.downloaded === true || status === "update-downloaded";
    const updateAvailable =
      source.updateAvailable === true ||
      downloaded ||
      status === "update-available" ||
      status === "downloading";

    return {
      status: error && (raw.ok === false || status === "error") ? "error" : status,
      checking: source.checking === true || status === "checking",
      updateAvailable,
      downloaded,
      info,
      progress,
      error,
    };
  }

  function updateVersionText(info) {
    const version = (
      info?.version ||
      info?.tag ||
      info?.releaseName ||
      ""
    ).toString().trim();
    return version || t("settings.update.unknownVersion", "Unknown version");
  }

  function updateErrorText(error) {
    if (!error) return "";
    if (typeof error === "string") return error;
    return (error.message || error.code || error.name || String(error)).toString();
  }

  function updateProgressPercent(progress) {
    const percent = Number(progress?.percent);
    if (!Number.isFinite(percent)) return "";
    return `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
  }

  function renderUpdateState(state) {
    const api = getUpdateApi();
    const normalized = normalizeUpdateState(state || { status: "idle" });
    currentUpdateState = normalized;

    if (!api) {
      setSettingsBadge(settingsUpdateBadgeEl, "bad", t("settings.update.unavailable", "Update API unavailable"));
      if (settingsUpdateStatusEl) settingsUpdateStatusEl.textContent = t("settings.update.unavailable", "Update API unavailable");
      if (settingsUpdateVersionEl) settingsUpdateVersionEl.textContent = t("settings.update.unknownVersion", "Unknown version");
      if (settingsUpdateProgressEl) settingsUpdateProgressEl.textContent = t("settings.update.noProgress", "No progress yet");
      if (btnUpdateCheck) btnUpdateCheck.disabled = true;
      if (btnUpdateDownload) btnUpdateDownload.disabled = true;
      if (btnUpdateRestart) btnUpdateRestart.disabled = true;
      return;
    }

    const status = normalized.status || "idle";
    const progressText = updateProgressPercent(normalized.progress);
    let badgeState = "warn";
    let badgeText = t("settings.update.badgeIdle", "Ready");
    let statusText = t("settings.update.idle", "Ready. No action taken.");

    if (status === "checking") {
      badgeState = "warn";
      badgeText = t("settings.update.badgeChecking", "Checking");
      statusText = t("settings.update.checking", "Checking for updates...");
    } else if (status === "update-available") {
      badgeState = "warn";
      badgeText = t("settings.update.badgeAvailable", "Available");
      statusText = t("settings.update.available", "Update available.");
    } else if (status === "update-not-available") {
      badgeState = "ok";
      badgeText = t("settings.update.badgeIdle", "Ready");
      statusText = t("settings.update.notAvailable", "Up to date.");
    } else if (status === "downloading") {
      badgeState = "warn";
      badgeText = t("settings.update.badgeDownloading", "Downloading");
      statusText = progressText
        ? `${t("settings.update.downloading", "Downloading update...")} ${progressText}`
        : t("settings.update.downloading", "Downloading update...");
    } else if (status === "update-downloaded") {
      badgeState = "ok";
      badgeText = t("settings.update.badgeDownloaded", "Downloaded");
      statusText = t("settings.update.downloaded", "Update downloaded. Restart to install.");
    } else if (status === "installing") {
      badgeState = "warn";
      badgeText = t("settings.update.badgeDownloaded", "Downloaded");
      statusText = t("settings.update.installing", "Installing update...");
    } else if (status === "error") {
      const message = updateErrorText(normalized.error);
      badgeState = "bad";
      badgeText = t("settings.update.badgeError", "Error");
      statusText = message
        ? `${t("settings.update.error", "Update error")}: ${message}`
        : t("settings.update.error", "Update error");
    }

    const busy = normalized.checking || status === "checking" || status === "downloading" || status === "installing";
    setSettingsBadge(settingsUpdateBadgeEl, badgeState, badgeText);
    if (settingsUpdateStatusEl) settingsUpdateStatusEl.textContent = statusText;
    if (settingsUpdateVersionEl) settingsUpdateVersionEl.textContent = updateVersionText(normalized.info);
    if (settingsUpdateProgressEl) settingsUpdateProgressEl.textContent = progressText || t("settings.update.noProgress", "No progress yet");
    if (btnUpdateCheck) btnUpdateCheck.disabled = busy;
    if (btnUpdateDownload) btnUpdateDownload.disabled = busy || normalized.updateAvailable !== true || normalized.downloaded === true;
    if (btnUpdateRestart) btnUpdateRestart.disabled = normalized.downloaded !== true || status === "installing";
  }

  async function refreshUpdateState() {
    const api = getUpdateApi();
    if (!api) {
      renderUpdateState({ status: "idle" });
      push("WARN(Update): update API unavailable");
      return null;
    }

    try {
      const state = await api.getState();
      renderUpdateState(state);
      return state;
    } catch (e) {
      const error = { message: e?.message || String(e) };
      renderUpdateState({ status: "error", error });
      push(`ERROR(Update state): ${error.message}`);
      return null;
    }
  }

  function handleUpdateStatus(message) {
    const state = normalizeUpdateState(message);
    renderUpdateState(state);

    if (state.status === "error") {
      push(`ERROR(Update): ${updateErrorText(state.error) || t("settings.update.error", "Update error")}`);
      return;
    }

    if (state.status === "downloading") {
      const percent = Number(state.progress?.percent);
      if (Number.isFinite(percent)) {
        const rounded = Math.floor(percent);
        if (lastUpdateProgressLogPercent == null || rounded >= lastUpdateProgressLogPercent + 10 || rounded >= 100) {
          lastUpdateProgressLogPercent = rounded;
          push(`Update download progress: ${percent.toFixed(1)}%`);
        }
      } else {
        push("Update status: downloading");
      }
      return;
    }

    lastUpdateProgressLogPercent = null;
    push(`Update status: ${state.status}`);
  }

  async function runUpdateAction(actionName, run) {
    const api = getUpdateApi();
    if (!api) {
      renderUpdateState({ status: "idle" });
      push("ERROR(Update): update API unavailable");
      return;
    }

    try {
      push(`Update ${actionName} requested`);
      const result = await run(api);
      const state = normalizeUpdateState(result);
      renderUpdateState(state);
      if (result?.ok === false) {
        push(`ERROR(Update ${actionName}): ${updateErrorText(result.error) || t("settings.update.error", "Update error")}`);
      }
    } catch (e) {
      const error = { message: e?.message || String(e) };
      renderUpdateState({ status: "error", error });
      push(`ERROR(Update ${actionName}): ${error.message}`);
    }
  }

  function getLicenseApi() {
    const api = window.electronAPI?.license;
    if (
      !api ||
      typeof api.getState !== "function" ||
      typeof api.startTrial !== "function" ||
      typeof api.activate !== "function" ||
      typeof api.validate !== "function" ||
      typeof api.openCheckout !== "function"
    ) {
      return null;
    }
    return api;
  }

  function getLicenseStatePayload(input) {
    if (input && typeof input === "object" && input.state && typeof input.state === "object") {
      return input.state;
    }
    return input && typeof input === "object" ? input : {};
  }

  function normalizeLicenseStatus(status) {
    const raw = (status || "").toString().trim();
    return raw || "not_registered";
  }

  function licenseStatusMeta(status) {
    const normalized = normalizeLicenseStatus(status);
    if (normalized === "trial_active") {
      return { state: "ok", text: t("settings.license.badgeTrialActive", "Trial Active") };
    }
    if (normalized === "licensed") {
      return { state: "ok", text: t("settings.license.badgeLicensed", "Licensed") };
    }
    if (normalized === "trial_expired") {
      return { state: "bad", text: t("settings.license.badgeExpired", "Trial Expired") };
    }
    if (normalized === "license_invalid") {
      return { state: "bad", text: t("settings.license.badgeInvalid", "License Invalid") };
    }
    if (normalized === "license_revoked") {
      return { state: "bad", text: t("settings.license.badgeRevoked", "License Revoked") };
    }
    if (normalized === "offline_grace") {
      return { state: "warn", text: t("settings.license.badgeOfflineGrace", "Offline Grace") };
    }
    if (normalized === "rate_limited") {
      return { state: "warn", text: t("settings.license.badgeRateLimited", "Too Many Attempts") };
    }
    if (normalized === "error") {
      return { state: "bad", text: t("settings.license.badgeError", "License Error") };
    }
    return { state: "warn", text: t("settings.license.badgeUnregistered", "Not Registered") };
  }

  function licenseValueText(value) {
    const text = (value || "").toString().trim();
    return text || t("common.notProvided", "Not provided");
  }

  function licenseDateText(value) {
    const text = (value || "").toString().trim();
    if (!text) return t("common.notProvided", "Not provided");
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) return text;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function licenseTrialRemainingText(status, trialExpiresAt) {
    const raw = (trialExpiresAt || "").toString().trim();
    if (!raw) return t("common.notProvided", "Not provided");
    if (normalizeLicenseStatus(status) === "trial_expired") {
      return t("settings.license.remainingExpired", "Expired");
    }

    const expiresAt = new Date(raw);
    if (Number.isNaN(expiresAt.getTime())) return raw;

    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return t("settings.license.remainingExpired", "Expired");
    }

    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));

    if (remainingDays >= 2) {
      return t("settings.license.remainingDays", "{count} days left").replace("{count}", String(remainingDays));
    }
    if (remainingDays >= 1) {
      return t("settings.license.remainingOneDay", "1 day left");
    }
    if (remainingHours >= 2) {
      return t("settings.license.remainingHours", "{count} hours left").replace("{count}", String(remainingHours));
    }
    if (remainingHours >= 1) {
      return t("settings.license.remainingOneHour", "1 hour left");
    }
    return t("settings.license.remainingLessThanHour", "Less than 1 hour left");
  }

  function localizeLicenseMessage(message) {
    const text = (message || "").toString().trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    if (lower.includes("hosted licensing backend") && lower.includes("not connected")) {
      return t("settings.license.messageBackendNotConnected", "Hosted licensing backend is not connected yet.");
    }
    if (lower.includes("checkout url") && lower.includes("not configured")) {
      return t("settings.license.messageCheckoutMissing", "Checkout URL is not configured yet.");
    }
    return text;
  }

  function setLicenseMessage(message, state) {
    if (!licenseMessageEl) return;
    licenseMessageEl.classList.remove("ok", "warn", "bad");
    if (state) licenseMessageEl.classList.add(state);
    licenseMessageEl.textContent = message || "";
  }

  function focusLicenseView(message, level) {
    skipNextLicenseViewRefresh = true;
    try { setActiveView("license"); } catch {}
    if (message) setLicenseMessage(message, level || "warn");
    window.setTimeout(() => {
      if (message) setLicenseMessage(message, level || "warn");
      const target = licenseEmailEl || btnLicenseStartTrial;
      try {
        if (target && typeof target.focus === "function") target.focus({ preventScroll: false });
      } catch {
        try { if (target && typeof target.focus === "function") target.focus(); } catch {}
      }
    }, 100);
  }

  function updateLicenseButtons() {
    const email = (licenseEmailEl?.value || "").toString().trim();
    const licenseKey = (licenseKeyEl?.value || "").toString().trim();
    if (btnLicenseStartTrial) btnLicenseStartTrial.disabled = !email;
    if (btnLicenseActivate) btnLicenseActivate.disabled = !licenseKey;
    if (btnLicenseValidate) btnLicenseValidate.disabled = false;
    if (btnLicenseCheckout) btnLicenseCheckout.disabled = false;
  }

  function renderLicenseState(input) {
    const state = getLicenseStatePayload(input);
    currentLicenseState = state;
    const meta = licenseStatusMeta(state.status);
    const registeredEmail = (state.registeredEmail || "").toString().trim();

    setSettingsBadge(settingsLicenseBadgeEl, meta.state, meta.text);
    if (licenseStatusEl) licenseStatusEl.textContent = meta.text;
    if (licenseRegisteredEmailEl) licenseRegisteredEmailEl.textContent = licenseValueText(registeredEmail);
    if (licenseTrialExpiresAtEl) licenseTrialExpiresAtEl.textContent = licenseDateText(state.trialExpiresAt);
    if (licenseTrialRemainingEl) licenseTrialRemainingEl.textContent = licenseTrialRemainingText(state.status, state.trialExpiresAt);
    if (licenseLastValidatedAtEl) licenseLastValidatedAtEl.textContent = licenseDateText(state.lastValidatedAt);
    if (licenseOfflineGraceExpiresAtEl) licenseOfflineGraceExpiresAtEl.textContent = licenseDateText(state.offlineGraceExpiresAt);
    if (licenseEmailEl && registeredEmail && !licenseEmailEl.value.trim()) {
      licenseEmailEl.value = registeredEmail;
    }
    updateLicenseButtons();
  }

  async function refreshLicenseState() {
    const api = getLicenseApi();
    if (!api) {
      renderLicenseState({ status: "error" });
      setLicenseMessage(t("settings.license.messageBlocked", "License action could not be completed."), "bad");
      push("ERROR(License state): license API unavailable");
      return null;
    }

    try {
      const state = await api.getState();
      renderLicenseState(state);
      if (state?.lastError) {
        setLicenseMessage(localizeLicenseMessage(state.lastError), "warn");
      }
      return state;
    } catch (e) {
      const message = e?.message || String(e);
      renderLicenseState({ ...(currentLicenseState || {}), status: "error", lastError: message });
      setLicenseMessage(`${t("settings.license.messageBlocked", "License action could not be completed.")} ${message}`, "bad");
      push(`ERROR(License state): ${message}`);
      return null;
    }
  }

  async function runLicenseAction(actionName, run) {
    const api = getLicenseApi();
    if (!api) {
      renderLicenseState({ status: "error" });
      setLicenseMessage(t("settings.license.messageBlocked", "License action could not be completed."), "bad");
      push(`ERROR(License ${actionName}): license API unavailable`);
      return null;
    }

    try {
      const result = await run(api);
      const state = getLicenseStatePayload(result);
      const ok = result && typeof result === "object" && result.ok === false ? false : true;
      const meta = licenseStatusMeta(state.status);
      const message = localizeLicenseMessage(result?.message) || (ok ? t("common.success", "Success") : t("settings.license.messageBlocked", "License action could not be completed."));
      renderLicenseState(state);
      setLicenseMessage(message, ok ? "ok" : meta.state === "bad" ? "bad" : "warn");
      push(`License ${actionName}: ${ok ? "completed" : "not completed"}`);
      return result;
    } catch (e) {
      const message = e?.message || String(e);
      renderLicenseState({ ...(currentLicenseState || {}), status: "error", lastError: message });
      setLicenseMessage(`${t("settings.license.messageBlocked", "License action could not be completed.")} ${message}`, "bad");
      push(`ERROR(License ${actionName}): ${message}`);
      return null;
    }
  }

  async function canStartWithLicense() {
    const blockedMessage = t("settings.license.messageStartBlocked", "Start blocked. Start a free trial or activate a license to use Direct Realtime.");
    const api = getLicenseApi();
    if (!api) {
      renderLicenseState({ ...(currentLicenseState || {}), status: "error" });
      focusLicenseView(blockedMessage, "bad");
      push("ERROR(License guard): license API unavailable; Direct Realtime start blocked.");
      return false;
    }

    try {
      const result = await api.getState();
      const state = getLicenseStatePayload(result);
      const status = normalizeLicenseStatus(state.status);
      if (status === "trial_active" || status === "licensed") {
        renderLicenseState(state);
        return true;
      }

      renderLicenseState(state);
      focusLicenseView(blockedMessage, "warn");
      push(`WARN(License guard): Direct Realtime start blocked; license status is ${status}.`);
      return false;
    } catch (e) {
      const message = e?.message || String(e);
      renderLicenseState({ ...(currentLicenseState || {}), status: "error", lastError: message });
      focusLicenseView(blockedMessage, "bad");
      push(`ERROR(License guard): ${message}; Direct Realtime start blocked.`);
      return false;
    }
  }

  function readScenarioText(lang, scenarioId, field) {
    const value = localeCatalogs?.scenarios?.[lang]?.[scenarioId]?.[field];
    return typeof value === "string" && value.trim() ? value : "";
  }

  function scenarioT(scenarioId, field, fallback) {
    const id = (scenarioId || "").toString().trim();
    const f = (field || "").toString().trim();
    const fb = fallback == null ? "" : fallback.toString();
    if (!id || !f) return fb;
    const lang = getDisplayLanguage();
    return readScenarioText(lang, id, f) || readScenarioText(DEFAULT_DISPLAY_LANGUAGE, id, f) || fb;
  }

  function localizeScenario(rawScenario) {
    if (!rawScenario) return null;
    const id = (rawScenario.id || "").toString().trim();
    const missing = t("common.notProvided", "Not provided");
    return {
      ...rawScenario,
      name: scenarioT(id, "name", rawScenario.name || id || missing),
      category: scenarioT(id, "category", rawScenario.category || missing),
      shortDescription: scenarioT(id, "shortDescription", rawScenario.shortDescription || missing),
      recommendedUse: scenarioT(id, "recommendedUse", rawScenario.recommendedUse || missing),
      displayDetails: scenarioT(id, "displayDetails", rawScenario.displayDetails || rawScenario.shortDescription || missing),
      instruction: (rawScenario.instruction || "").toString(),
      userInstruction: (rawScenario.userInstruction || "").toString(),
      userInstructionUpdatedAt: (rawScenario.userInstructionUpdatedAt || "").toString(),
    };
  }

  function getInstructionDefaultVariants(presetKey) {
    const key = normalizeInstructionPresetKey(presetKey);
    const values = [];
    const scenario = getScenarioPresetById(key);
    if (scenario?.instruction) values.push(scenario.instruction.toString());
    if (Object.prototype.hasOwnProperty.call(INSTRUCTION_PRESETS, key)) values.push(INSTRUCTION_PRESETS[key]);
    return Array.from(new Set(values.filter((value) => (value || "").toString().trim())));
  }

  // Playback pipeline (Realtime) routed to rtOutEl via MediaStreamDestination
  let playbackCtx = null;
  let playhead = 0;
  let playbackDest = null;
  let playbackVolume = 1.0;
  let playbackGainNode = null;
  const activePlaybackSources = new Set();
  let isAssistantSpeaking = false;
  function setAssistantSpeaking(active) {
    isAssistantSpeaking = !!active;
    setSpeakingIndicator(isAssistantSpeaking);
  }

  // ------------------------------
  // Initialize settings into inputs
  // ------------------------------
  function loadEndpointSettingsIntoInputs() {
    $("rtHttp").value = loadStrLS(LS_RT_HTTP, DEFAULTS.REALTIME_HTTP);
    $("rtWs").value = loadStrLS(LS_RT_WS, DEFAULTS.REALTIME_WS);
    updateEndpointSummaryUi();
  }
function loadVoiceSettingsIntoInputs() {
  const rate = normalizeRealtimeRate(loadStrLS(LS_REALTIME_RATE, DEFAULT_REALTIME_RATE));
  if (realtimeRateEl) realtimeRateEl.value = rate;
  if (realtimeRateVoiceEl) realtimeRateVoiceEl.value = rate;
}
function loadCostGuardSettingsIntoInputs() {
  if (idleGuardMinutesEl) {
    idleGuardMinutesEl.value = loadStrLS(LS_IDLE_GUARD_MINUTES, "0");
  }

  if (idleGuardWarnEl) {
    idleGuardWarnEl.checked = loadStrLS(LS_IDLE_GUARD_WARN, "1") !== "0";
  }

  if (maxSessionMinutesEl) {
    maxSessionMinutesEl.value = loadStrLS(LS_MAX_SESSION_MINUTES, "0");
  }
  updateCostGuardSummaryUi();
}

function updateCostGuardSummaryUi() {
  const idle = (idleGuardMinutesEl?.value || "0").toString();
  const max = (maxSessionMinutesEl?.value || "0").toString();
  const enabled = idle !== "0" || max !== "0";
  if (settingsCostGuardBadgeEl) {
    setSettingsBadge(settingsCostGuardBadgeEl, enabled ? "warn" : "ok", enabled ? t("settings.costGuard.ready", "Cost Guard Ready") : t("common.off", "Off"));
  }
}

function normalizePlaybackVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(2.0, Math.max(0.0, n));
}

function updatePlaybackVolumeUi() {
  if (playbackVolumeEl) playbackVolumeEl.value = String(playbackVolume);
  if (playbackVolumeValueEl) playbackVolumeValueEl.textContent = playbackVolume.toFixed(2);
  if (bottomVolumeMirrorEl) bottomVolumeMirrorEl.value = String(playbackVolume);
  if (bottomVolumeValueEl) bottomVolumeValueEl.textContent = playbackVolume.toFixed(2);
  if (settingsPlaybackVolumeTextEl) settingsPlaybackVolumeTextEl.textContent = playbackVolume.toFixed(2);
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
    setSettingsBadge(authStatusEl, token ? "ok" : "warn", token ? t("common.tokenSet", "Token set") : t("common.noToken", "No token"));
  }
  let providerCapabilitiesState = null;
  let providerConfigState = null;

  loadEndpointSettingsIntoInputs();
  initAuthUi();
  loadVoiceSettingsIntoInputs();
  loadCostGuardSettingsIntoInputs();
  applyPlaybackVolume(loadStrLS(LS_PLAYBACK_VOLUME, "1"));
  loadInstructionsTargetIntoInputs();
  syncDisplayLanguageControls(getDisplayLanguage());
  applyLocale();
  loadLocaleCatalogs().then(() => applyLocale()).catch(() => {});
  loadProviderUi().catch(() => {});
  refreshUpdateState().catch(() => {});
  updateLicenseButtons();
  refreshLicenseState().catch(() => {});
  try {
    const updates = getUpdateApi();
    if (updates && typeof updates.onStatus === "function") {
      updates.onStatus(handleUpdateStatus);
    }
  } catch (e) {
    push(`WARN(Update status subscription): ${e?.message || e}`);
  }

  function setProviderStatus(message) {
    if (providerStatusEl) providerStatusEl.textContent = message || "";
    const m = (message || "").toLowerCase();
    if (m.includes("test passed")) {
      setSettingsBadge(settingsProviderBadgeEl, "ok", t("settings.provider.validated", "Provider Validated"));
      if (settingsDiagProviderTestEl) settingsDiagProviderTestEl.textContent = t("common.success", "Success");
    } else if (m.includes("test failed")) {
      setSettingsBadge(settingsProviderBadgeEl, "bad", t("settings.provider.testFailed", "Test Failed"));
      if (settingsDiagProviderTestEl) settingsDiagProviderTestEl.textContent = t("common.failed", "Failed");
    } else if (m.includes("incomplete") || m.includes("missing") || m.includes("load failed")) {
      setSettingsBadge(settingsProviderBadgeEl, "warn", t("settings.provider.needsAttention", "Needs Attention"));
      if (settingsDiagProviderTestEl) settingsDiagProviderTestEl.textContent = t("common.notTested", "Not tested");
    } else {
      setSettingsBadge(settingsProviderBadgeEl, "warn", t("common.notTested", "Not tested"));
      if (settingsDiagProviderTestEl) settingsDiagProviderTestEl.textContent = t("common.notTested", "Not tested");
    }
  }

  function fillSelectOptions(selectEl, items, selectedValue) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    for (const item of items || []) {
      const opt = document.createElement("option");
      opt.value = item.code || item;
      opt.textContent = item.label || item.code || item;
      selectEl.appendChild(opt);
    }
    if (selectedValue) selectEl.value = selectedValue;
  }

  function getSelectedProviderId() {
    return (providerActiveEl?.value || "azure-openai-realtime").toString();
  }

  function selectedOptionText(selectEl) {
    if (!selectEl) return "";
    return (selectEl.options?.[selectEl.selectedIndex]?.textContent || selectEl.value || "").toString().trim();
  }

  function providerDisplayName(providerId) {
    const caps = providerCapabilitiesState?.providers?.[providerId];
    if (!caps) return "";
    return (caps.label || caps.name || providerId || "").toString().trim();
  }

  function updateProviderSummaryUi() {
    const activeProvider = getSelectedProviderId();
    const notLoaded = t("common.notLoaded", "Not loaded");
    const providerName = providerDisplayName(activeProvider) || notLoaded;
    const model = (providerModelEl?.value || "").toString().trim() || notLoaded;
    const voice = selectedOptionText(providerVoiceEl) || notLoaded;
    const outgoing = selectedOptionText(providerOutgoingLanguageEl) || notLoaded;
    if (headerProviderSummaryEl) headerProviderSummaryEl.textContent = providerName;
    if (voiceStatusProviderEl) voiceStatusProviderEl.textContent = providerName;
    if (voiceStatusModelEl) voiceStatusModelEl.textContent = model;
    if (voiceStatusVoiceEl) voiceStatusVoiceEl.textContent = voice;
    if (voiceStatusOutputLanguageEl) voiceStatusOutputLanguageEl.textContent = outgoing;
  }

  function applyProviderUi(providerId) {
    const caps = providerCapabilitiesState?.providers?.[providerId];
    const cfgProvider = providerConfigState?.providers?.[providerId] || {};
    if (!caps) {
      updateProviderSummaryUi();
      return;
    }

    if (providerRegionRow) providerRegionRow.style.display = caps.requiresRegion ? "" : "none";
    if (providerEndpointRow) providerEndpointRow.style.display = caps.requiresEndpoint ? "" : "none";
    if (providerApiVersionRow) providerApiVersionRow.style.display = caps.requiresApiVersion ? "" : "none";

    if (providerModelLabelEl) providerModelLabelEl.textContent = caps.modelLabel || "Model";
    fillSelectOptions(providerRegionEl, caps.supportedRegions || [], cfgProvider.region || "eastus2");
    if (providerEndpointEl) providerEndpointEl.value = cfgProvider.endpoint || "";
    if (providerApiVersionEl) providerApiVersionEl.value = cfgProvider.apiVersion || caps.defaultApiVersion || "";
    if (providerModelEl) providerModelEl.value = cfgProvider.model || caps.defaultModel || "";
    if (providerApiKeyEl) providerApiKeyEl.value = cfgProvider.apiKey || "";

    fillSelectOptions(providerVoiceEl, caps.supportedVoices || [], cfgProvider.voice || caps.defaultVoice);
    fillSelectOptions(providerIncomingLanguageEl, caps.supportedIncomingLanguages || [], cfgProvider.incomingLanguage || caps.defaultIncomingLanguage || "en");
    fillSelectOptions(providerOutgoingLanguageEl, caps.supportedOutgoingLanguages || [], cfgProvider.outgoingLanguage || caps.defaultOutgoingLanguage || "en");
    updateProviderSummaryUi();
  }
  function buildProviderConfigFromUi() {

    const activeProvider = getSelectedProviderId();
    const currentProviders = providerConfigState?.providers || {};
    const nextProviders = JSON.parse(JSON.stringify(currentProviders));
    const existing = nextProviders[activeProvider] || {};

    nextProviders[activeProvider] = {
      ...existing,
      region: (providerRegionEl?.value || "").trim(),
      endpoint: (providerEndpointEl?.value || "").trim(),
      apiVersion: (providerApiVersionEl?.value || "").trim(),
      model: (providerModelEl?.value || "").trim(),
      voice: (providerVoiceEl?.value || "").trim(),
      incomingLanguage: (providerIncomingLanguageEl?.value || "").trim(),
      outgoingLanguage: (providerOutgoingLanguageEl?.value || "").trim(),
      apiKey: (providerApiKeyEl?.value || "").trim(),
    };

    return {
      version: providerConfigState?.version || 1,
      activeProvider,
      providers: nextProviders,
    };
  }

  async function loadProviderUi() {
    try {
      const c = directRealtimeCfg();
      const [capsRes, cfgRes] = await Promise.all([
        fetch(`${c.REALTIME_HTTP}/v1/provider/capabilities`, { headers: authHeaders() }),
        fetch(`${c.REALTIME_HTTP}/v1/provider/config`, { headers: authHeaders() }),
      ]);
      if (!capsRes.ok) throw new Error(`capabilities HTTP ${capsRes.status}`);
      if (!cfgRes.ok) throw new Error(`config HTTP ${cfgRes.status}`);
      providerCapabilitiesState = await capsRes.json();
      providerConfigState = await cfgRes.json();

      const active = providerConfigState.activeProvider || providerCapabilitiesState.defaultProvider || "azure-openai-realtime";
      if (providerActiveEl) providerActiveEl.value = active;
      applyProviderUi(active);
      setProviderStatus("Provider config loaded");
    } catch (e) {
      setProviderStatus(`Provider config load failed: ${e?.message || e}`);
      updateProviderSummaryUi();
    }
  }
function normalizeRealtimeRate(rate) {
  const r = (rate || "").toString().trim();
  return ALLOWED_REALTIME_RATES.includes(r) ? r : DEFAULT_REALTIME_RATE;
}
function getRealtimeRate() {
  const uiVoice = (realtimeRateVoiceEl?.value || "").toString().trim();
  const uiSettings = (realtimeRateEl?.value || "").toString().trim();
  return normalizeRealtimeRate(uiVoice || uiSettings || loadStrLS(LS_REALTIME_RATE, DEFAULT_REALTIME_RATE));
}
function buildVoiceWsUrl(baseWsUrl, rate) {
  const base = (baseWsUrl || "").toString().trim().replace(/\/+$/, "");
  const r = normalizeRealtimeRate(rate);
  try {
    const u = new URL(base);
    u.searchParams.set("engine", "realtime");
    u.searchParams.set("rate", r);
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}engine=realtime&rate=${encodeURIComponent(r)}`;
  }
}

function directRealtimeCfg() {
  const rate = getRealtimeRate();
  const rtWsBase = $("rtWs").value.replace(/\/+$/, "");
  return {
    REALTIME_HTTP: $("rtHttp").value.replace(/\/+$/, ""),
    REALTIME_WS: rtWsBase,
    REALTIME_RATE: rate,
    VOICE_WS: buildVoiceWsUrl(rtWsBase, rate),
  };
}
  // ------------------------------
  // Desired connection state + reconnect (Realtime)
  // ------------------------------
  let desiredConnected = false;
  let rtWs = null;
  let rtReconnectAttempt = 0;
  let rtReconnectTimer = null;
  let rtReconnectSuppressOnce = false; // used for deliberate voice WS reconfigure
  // Keepalive ping timers
  let rtPingTimer = null;
  function clearPingTimers() {
    try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
    rtPingTimer = null;
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
    try { if (rtReconnectTimer) window.clearTimeout(rtReconnectTimer); } catch {}
    rtReconnectTimer = null;
  }
  const WS_PING_INTERVAL_MS = 30000; // 30s keepalive ping
  const WS_MAX_BACKOFF_MS = 30000;   // strict max 30s
  function backoffMs(attempt) {
    const base = Math.min(WS_MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.max(0, attempt)));
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(WS_MAX_BACKOFF_MS, base + jitter);
  }
  function setRealtimeStatus(state) {
    updateSettingsWsStatus(state);
    if (state === "ON") {
      setPill("rtStatus", "ok", "REALTIME: ON");
      setSessionStatus("ON");
    } else if (state === "RECONNECTING") {
      setPill("rtStatus", "warn", "REALTIME: RECONNECTING");
      setSessionStatus("RECONNECTING");
    } else {
      setPill("rtStatus", "bad", "REALTIME: OFF");
      if (!directRealtimeActive && !directRealtimeStarting) setSessionStatus("OFF");
    }
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
const INSTRUCTION_PRESET_LABELS = {
  neutral_conversation: "Neutral Conversation",
  cloud_solution_architect: "Cloud Solution Architect",
  interview_candidate: "Interview Candidate",
};
const DEFAULT_INSTRUCTION_PRESET = "neutral_conversation";
let scenarioPresetStore = {
  version: 0,
  defaultScenarioId: "",
  activeScenarioId: "",
  scenarios: [],
  byId: {},
  source: "",
  defaultSource: "",
};

function isInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  return Object.prototype.hasOwnProperty.call(INSTRUCTION_PRESETS, k) || !!getScenarioPresetById(k);
}
function normalizeInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  if (isInstructionPresetKey(k)) return k;
  const scenarioDefault = (scenarioPresetStore.activeScenarioId || scenarioPresetStore.defaultScenarioId || "").toString().trim();
  return scenarioDefault && getScenarioPresetById(scenarioDefault) ? scenarioDefault : DEFAULT_INSTRUCTION_PRESET;
}
function normalizeStoredInstructionPresetKey(presetKey) {
  const k = (presetKey || "").toString().trim();
  return isInstructionPresetKey(k) ? k : "";
}
function findInstructionPresetForText(text) {
  const t = (text || "").toString();
  for (const scenario of scenarioPresetStore.scenarios || []) {
    if (getInstructionDefaultVariants(scenario.id).some((value) => t === value)) return scenario.id;
  }
  for (const [key, value] of Object.entries(INSTRUCTION_PRESETS)) {
    if (t === value || getInstructionDefaultVariants(key).some((candidate) => t === candidate)) return key;
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
  updateVoiceScenarioUI();
  return key;
}
function getInstructionPresetText(presetKey) {
  const key = normalizeInstructionPresetKey(presetKey);
  const scenario = getScenarioPresetById(key);
  if (scenario) return scenario.userInstruction || scenario.instruction;
  return INSTRUCTION_PRESETS[key];
}
function getInstructionPresetDefaultText(presetKey) {
  const key = normalizeInstructionPresetKey(presetKey);
  const scenario = getScenarioPresetById(key);
  return scenario ? scenario.instruction : INSTRUCTION_PRESETS[key];
}
function getScenarioPresetById(id) {
  const key = (id || "").toString().trim();
  return key ? (scenarioPresetStore.byId[key] || null) : null;
}
function normalizeScenarioPreset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw.id || "").toString().trim();
  const instruction = (raw.instruction || "").toString();
  if (!id || !instruction.trim()) return null;
  return {
    id,
    name: (raw.name || id).toString(),
    category: (raw.category || "").toString(),
    shortDescription: (raw.shortDescription || "").toString(),
    recommendedUse: (raw.recommendedUse || "").toString(),
    displayDetails: (raw.displayDetails || "").toString(),
    defaultIncomingLanguage: (raw.defaultIncomingLanguage || "").toString(),
    defaultOutgoingLanguage: (raw.defaultOutgoingLanguage || "").toString(),
    instruction,
    userInstruction: (raw.userInstruction || "").toString(),
    userInstructionUpdatedAt: (raw.userInstructionUpdatedAt || "").toString(),
  };
}
function applyScenarioPresetData(data) {
  const scenarios = Array.isArray(data?.scenarios)
    ? data.scenarios.map(normalizeScenarioPreset).filter(Boolean)
    : [];
  const byId = {};
  for (const scenario of scenarios) byId[scenario.id] = scenario;
  scenarioPresetStore = {
    version: Number(data?.version || 0),
    defaultScenarioId: (data?.defaultScenarioId || "").toString(),
    activeScenarioId: (data?.activeScenarioId || "").toString(),
    scenarios,
    byId,
    source: (data?.source || "").toString(),
    defaultSource: (data?.defaultSource || "").toString(),
  };
  return scenarioPresetStore;
}
async function fetchScenariosFromBackend() {
  const c = directRealtimeCfg();
  const res = await fetch(`${c.REALTIME_HTTP}/v1/scenarios`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return applyScenarioPresetData(data);
}

async function saveActiveScenarioToBackend(scenarioId, { silent } = {}) {
  const id = (scenarioId || "").toString().trim();
  if (!id || !getScenarioPresetById(id)) {
    return { ok: false, skipped: true };
  }

  const c = directRealtimeCfg();

  try {
    const res = await fetch(`${c.REALTIME_HTTP}/v1/scenarios/active`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scenarioId: id }),
    });

    if (!res.ok) {
      if (!silent) push(`WARN: active scenario save failed (HTTP ${res.status})`);
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    scenarioPresetStore.activeScenarioId = (data?.activeScenarioId || id).toString();

    return { ok: true, status: res.status };
  } catch (e) {
    if (!silent) push(`WARN: active scenario save failed: ${e?.message || e}`);
    return { ok: false, status: 0 };
  }
}

async function saveScenarioUserInstructionToBackend(scenarioId, instruction, { silent } = {}) {
  const id = (scenarioId || "").toString().trim();
  if (!id || !getScenarioPresetById(id)) {
    return { ok: false, skipped: true };
  }

  const c = directRealtimeCfg();

  try {
    const res = await fetch(`${c.REALTIME_HTTP}/v1/scenarios/instruction`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scenarioId: id,
        instruction: (instruction || "").toString(),
      }),
    });

    if (!res.ok) {
      if (!silent) push(`WARN: scenario instruction save failed (HTTP ${res.status})`);
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    applyScenarioPresetData(data);
    return { ok: true, status: res.status };
  } catch (e) {
    if (!silent) push(`WARN: scenario instruction save failed: ${e?.message || e}`);
    return { ok: false, status: 0 };
  }
}

async function deleteScenarioUserInstructionFromBackend(scenarioId, { silent } = {}) {
  const id = (scenarioId || "").toString().trim();
  if (!id || !getScenarioPresetById(id)) {
    return { ok: false, skipped: true };
  }

  const c = directRealtimeCfg();

  try {
    const res = await fetch(`${c.REALTIME_HTTP}/v1/scenarios/instruction/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!res.ok) {
      if (!silent) push(`WARN: scenario instruction reset failed (HTTP ${res.status})`);
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    applyScenarioPresetData(data);
    return { ok: true, status: res.status };
  } catch (e) {
    if (!silent) push(`WARN: scenario instruction reset failed: ${e?.message || e}`);
    return { ok: false, status: 0 };
  }
}

function appendPresetOption(parent, value, label) {
  if (!parent) return;
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  parent.appendChild(opt);
}
function appendScenarioPreviewLine(parent, className, label, value) {
  const line = document.createElement("div");
  line.className = className;
  line.textContent = label ? `${label}: ${scenarioDisplayValue(value)}` : scenarioDisplayValue(value);
  parent.appendChild(line);
}
function renderScenarioLibraryPreview(scenario) {
  if (!scenarioLibraryPreviewEl) return;
  const localized = scenario ? localizeScenario(scenario) : null;

  scenarioLibraryPreviewEl.replaceChildren();
  if (!localized) {
    appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewTitle", "", t("scenarios.preview.title", "Scenario Preview"));
    appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewMeta", t("scenarios.preview.category", "Category"), "");
    appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewText", t("scenarios.preview.details", "Details"), t("scenarios.preview.emptyDetails", "Hover a scenario card to preview metadata."));
    appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewText", t("scenarios.preview.recommendedUse", "Recommended use"), "");
    return;
  }

  appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewTitle", "", localized.name || localized.id);
  appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewMeta", t("scenarios.preview.category", "Category"), localized.category);
  appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewText", t("scenarios.preview.details", "Details"), localized.displayDetails || localized.shortDescription);
  appendScenarioPreviewLine(scenarioLibraryPreviewEl, "scenarioPreviewText", t("scenarios.preview.recommendedUse", "Recommended use"), localized.recommendedUse);
}
function resetScenarioLibraryPreview() {
  renderScenarioLibraryPreview(getScenarioPresetById(getInstructionPreset()));
}
function renderScenarioCards() {
  if (!scenarioCardsEl) return;

  const scenarios = Array.isArray(scenarioPresetStore?.scenarios)
    ? scenarioPresetStore.scenarios
    : [];

  scenarioCardsEl.innerHTML = "";

  if (!scenarios.length) {
    const empty = document.createElement("div");
    empty.className = "small";
    empty.textContent = t("scenarios.library.empty", "Scenario cards will load from the backend.");
    scenarioCardsEl.appendChild(empty);
    resetScenarioLibraryPreview();
    updateScenarioInstructionsUI();
    return;
  }

  const selectedId = getInstructionPreset();

  for (const scenario of scenarios) {
    const id = (scenario?.id || "").toString().trim();
    if (!id) continue;
    const localized = localizeScenario(scenario);

    const card = document.createElement("button");
    card.type = "button";
    card.className = id === selectedId ? "card scenarioCard active" : "card scenarioCard";
    card.dataset.scenarioId = id;
    card.setAttribute("aria-pressed", id === selectedId ? "true" : "false");

    const icon = document.createElement("span");
    icon.className = "scenarioCardIcon";

    const title = document.createElement("strong");
    title.className = "scenarioCardTitle";
    title.textContent = localized?.name || id;

    const state = document.createElement("span");
    state.className = "scenarioCardState";
    state.textContent = id === selectedId ? t("scenarios.card.selected", "Selected") : t("scenarios.card.clickToSelect", "Click to select");

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(state);

    card.addEventListener("mouseenter", () => renderScenarioLibraryPreview(scenario));
    card.addEventListener("focus", () => renderScenarioLibraryPreview(scenario));
    card.addEventListener("mouseleave", resetScenarioLibraryPreview);
    card.addEventListener("blur", resetScenarioLibraryPreview);

    card.addEventListener("click", () => {
      applyInstructionPresetToEditor(id).catch((e) => {
        push(`WARN: scenario card apply failed: ${e?.message || e}`);
      });
    });

    scenarioCardsEl.appendChild(card);
  }
  resetScenarioLibraryPreview();
  updateScenarioInstructionsUI();
}
function renderScenarioPresetDropdown() {
  if (!instructionPresetEl) return;
  const storedPreset = loadStrLS(LS_INSTRUCTION_PRESET, "");
  const scenarioDefault = (scenarioPresetStore.activeScenarioId || scenarioPresetStore.defaultScenarioId || "").toString().trim();
  const previous = (
    storedPreset ||
    scenarioDefault ||
    instructionPresetEl.value ||
    DEFAULT_INSTRUCTION_PRESET
  ).toString().trim();
  instructionPresetEl.innerHTML = "";

  if ((scenarioPresetStore.scenarios || []).length) {
    const scenarioGroup = document.createElement("optgroup");
    scenarioGroup.label = t("nav.scenarios", "Scenarios");
    for (const scenario of scenarioPresetStore.scenarios) {
      const localized = localizeScenario(scenario);
      appendPresetOption(scenarioGroup, scenario.id, localized?.name || scenario.id);
    }
    instructionPresetEl.appendChild(scenarioGroup);

  } else {
    for (const key of Object.keys(INSTRUCTION_PRESETS)) {
      appendPresetOption(instructionPresetEl, key, scenarioT(key, "name", INSTRUCTION_PRESET_LABELS[key] || key));
    }
  }

  instructionPresetEl.value = normalizeInstructionPresetKey(previous);
  renderScenarioCards();
  updateVoiceScenarioUI();
}
function updateVoiceScenarioUI() {
  if (!voiceScenarioNameEl && !voiceScenarioDescriptionEl) return;

  const id = getInstructionPreset();
  const scenario = getScenarioPresetById(id);
  const localized = scenario ? localizeScenario(scenario) : null;

  let name = t("common.notLoaded", "Not loaded");
  let description = t("voice.scenarioFallback", "Scenario behavior is loaded from the Scenarios tab.");

  if (localized) {
    name = localized.name || localized.id || name;
    description = localized.shortDescription || localized.recommendedUse || description;
  } else if (id === "neutral_conversation") {
    name = scenarioT(id, "name", "Neutral Conversation");
    description = "General realtime conversation mode.";
  } else if (id === "cloud_solution_architect") {
    name = scenarioT(id, "name", "Cloud Solution Architect");
    description = "Cloud architecture guidance for live technical conversations.";
  } else if (id === "interview_candidate") {
    name = scenarioT(id, "name", "Interview Candidate");
    description = "Interview answer coaching for candidate-style responses.";
  }

  if (voiceScenarioNameEl) voiceScenarioNameEl.textContent = name;
  if (voiceScenarioDescriptionEl) voiceScenarioDescriptionEl.textContent = description;
  updateScenarioInstructionsUI();
}
function scenarioDisplayValue(value) {
  const text = (value || "").toString().trim();
  return text || t("common.notProvided", "Not provided");
}
function setScenarioBadge(el, text, tone) {
  if (!el) return;
  el.classList.remove("scenarioBadgeBlue", "scenarioBadgeGreen", "scenarioBadgeAmber", "scenarioBadgeRed");
  el.classList.add(tone || "scenarioBadgeBlue");
  el.textContent = text;
}
function getInstructionOverrideState(scenario, current, defaultText) {
  const scenarioOverride = !!(scenario?.userInstruction || "").toString().trim();
  const currentText = (current || "").toString();
  const baseText = (defaultText || "").toString();

  if (scenarioOverride) return { text: t("scenarios.customOverrideLoaded", "Custom override loaded"), tone: "scenarioBadgeAmber" };
  if (currentText.trim() && baseText.trim() && currentText !== baseText) {
    return { text: t("scenarios.editedOverride", "Edited override"), tone: "scenarioBadgeAmber" };
  }
  if (scenario) return { text: t("scenarios.defaultState", "Scenario default"), tone: "scenarioBadgeGreen" };
  return { text: t("common.notProvided", "Not provided"), tone: "scenarioBadgeAmber" };
}
function updateScenarioInstructionsUI() {
  const id = getInstructionPreset();
  const scenario = getScenarioPresetById(id);
  const localized = scenario ? localizeScenario(scenario) : null;
  const target = getInstrTarget();
  const doc = instructionStore?.[target] || emptyInstrDoc();
  const name = localized ? (localized.name || localized.id) : scenarioDisplayValue(id);
  const description = localized
    ? scenarioDisplayValue(localized.shortDescription || localized.recommendedUse)
    : t("common.notProvided", "Not provided");
  const defaultText = (instrDefaultEl?.value || doc.default || getInstructionPresetDefaultText(id) || "").toString();
  const currentText = (instrCurrentEl?.value || doc.current || "").toString();
  const override = getInstructionOverrideState(scenario, currentText, defaultText);
  const refreshState =
    rtWs && rtWs.readyState === WebSocket.OPEN
      ? t("scenarios.refreshConnected", "Realtime session connected")
      : rtWs && rtWs.readyState === WebSocket.CONNECTING
        ? t("scenarios.refreshConnecting", "Realtime session connecting")
        : t("scenarios.refreshRequiresSession", "Requires active realtime session");

  if (scenarioSelectedNameEl) scenarioSelectedNameEl.textContent = name;
  if (scenarioSelectedDescriptionEl) scenarioSelectedDescriptionEl.textContent = description;
  setScenarioBadge(scenarioSelectedBadgeEl, scenario ? t("scenarios.activeScenario", "Active scenario") : t("common.notLoaded", "Not loaded"), "scenarioBadgeBlue");
  setScenarioBadge(scenarioOverrideBadgeEl, override.text, override.tone);
  setScenarioBadge(scenarioActiveStateEl, scenario ? t("scenarios.selectedActive", "Selected / Active") : t("common.notLoaded", "Not loaded"), "scenarioBadgeBlue");
  setScenarioBadge(scenarioCustomStateEl, override.text, override.tone);

  if (scenarioDetailsCategoryEl) scenarioDetailsCategoryEl.textContent = scenarioDisplayValue(localized?.category);
  if (scenarioDetailsShortEl) scenarioDetailsShortEl.textContent = scenarioDisplayValue(localized?.shortDescription);
  if (scenarioDetailsUseEl) scenarioDetailsUseEl.textContent = scenarioDisplayValue(localized?.recommendedUse);
  if (instrSourceEl) instrSourceEl.textContent = scenarioDisplayValue(doc.source);
  if (instrUpdatedAtEl) instrUpdatedAtEl.textContent = scenarioDisplayValue(doc.updatedAt);
  if (instrBackendEl) instrBackendEl.textContent = getBackendLabelForTarget(target);
  if (scenarioStateActiveEl) scenarioStateActiveEl.textContent = scenario ? `${name} (${scenario.id})` : t("common.notProvided", "Not provided");
  if (scenarioStateOverrideEl) scenarioStateOverrideEl.textContent = override.text;
  if (scenarioStateRefreshEl) scenarioStateRefreshEl.textContent = refreshState;
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
  const c = directRealtimeCfg();
  return c.REALTIME_HTTP || "(realtime not set)";
}

// Voice view: instructions preview panel uses Direct Realtime instructions.
function getEffectiveInstructionsForEngine() {
  return (instructionStore?.realtime?.current || instructionStore?.realtime?.default || "").toString();
}

function updateVoiceInstructionsUI() {
  updateVoiceScenarioUI();
  if (!voiceInstrTextEl) return;
  const eff = getEffectiveInstructionsForEngine().trim();
  voiceInstrTextEl.textContent = eff ? eff : t("common.notLoaded", "Not loaded");
  if (voiceInstrUpdatedAtEl) {
    const ua = (instructionStore?.realtime?.updatedAt || "").toString();
    voiceInstrUpdatedAtEl.textContent = ua ? ua : t("common.notLoaded", "Not loaded");
  }
}

function applyTargetDocToEditor(target, statusText, { silent } = {}) {
  const t = normalizeInstrTarget(target);
  const d = instructionStore?.[t] || emptyInstrDoc();
  if (instrCurrentEl) instrCurrentEl.value = (d.current || "").toString();
  if (instrDefaultEl) instrDefaultEl.value = (d.default || "").toString();
  if (instrUpdatedAtEl) instrUpdatedAtEl.textContent = scenarioDisplayValue(d.updatedAt);
  if (instrSourceEl) instrSourceEl.textContent = scenarioDisplayValue(d.source);
  if (instrBackendEl) instrBackendEl.textContent = getBackendLabelForTarget(t);
  if (instrStatusEl && statusText) instrStatusEl.textContent = statusText;

  updateVoiceInstructionsUI();
  updateScenarioInstructionsUI();

  if (!silent && d.updatedAt) push(`Instructions loaded (target=${t}) (${statusText || "ok"}) (${d.updatedAt})`);
}

async function fetchInstructionsFromBackend(_target) {
  const c = directRealtimeCfg();

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
  const c = directRealtimeCfg();
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
  const defaultText = getInstructionPresetDefaultText(preset);
  const updatedAt = new Date().toISOString();

  setInstrTarget("realtime");
  instructionStore = instructionStore || normalizeStore(null);
  instructionStore.realtime = {
    current,
    default: defaultText,
    updatedAt,
    source: "preset-ui",
    preset,
  };

  applyTargetDocToEditor("realtime", "Preset applied", { silent: true });
  renderScenarioCards();
  updateVoiceScenarioUI();

  let localOk = true;
  if (hasLocalInstructionStore()) {
    localOk = await writeLocalInstructionStore(instructionStore);
    if (!localOk) push("WARN: local preset write failed");
  }

  await saveActiveScenarioToBackend(preset, { silent: true });

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
      updatedAt: backend.updatedAt || "",
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

      // Best-effort scenario override save and backend sync (do NOT overwrite local)
      const scenarioSave = getScenarioPresetById(preset)
        ? await saveScenarioUserInstructionToBackend(preset, currentToSave, { silent: true })
        : { ok: true, skipped: true };
      if (!scenarioSave.ok && !scenarioSave.skipped) {
        push("WARN: scenario instruction save failed; local remains authoritative");
      }

      const sync = await syncInstructionsToBackend(target, currentToSave, { silent: true });
      if (instrStatusEl) {
        instrStatusEl.textContent = sync.ok
          ? ((scenarioSave.ok || scenarioSave.skipped) ? "Saved (local) + synced" : "Saved (local) + synced (scenario save failed)")
          : "Saved (local) (sync failed)";
      }
      if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
      renderScenarioCards();
      updateVoiceScenarioUI();
      return;
    }

    if (instrStatusEl) instrStatusEl.textContent = "Local save failed; trying backend...";
  }

  // Backend fallback (non-Electron / local store unavailable)
  try {
    const scenarioSave = getScenarioPresetById(preset)
      ? await saveScenarioUserInstructionToBackend(preset, currentToSave, { silent: true })
      : { ok: true, skipped: true };
    if (!scenarioSave.ok && !scenarioSave.skipped) {
      push("WARN: scenario instruction save failed");
    }

    const sync = await syncInstructionsToBackend(target, currentToSave, { silent: false });
    if (instrStatusEl) {
      instrStatusEl.textContent = sync.ok
        ? ((scenarioSave.ok || scenarioSave.skipped) ? "Saved (backend)" : "Saved (backend, scenario save failed)")
        : "Save failed";
    }
    await loadInstructionsFromBackendExplicit({ silent: true });
    renderScenarioCards();
    updateVoiceScenarioUI();
  } catch {
    if (instrStatusEl) instrStatusEl.textContent = "Save failed (network error)";
  }
}

async function resetInstructionsToDefault() {
  const target = getInstrTarget();
  const preset = getInstructionPreset();
  const presetText = getInstructionPresetDefaultText(preset);
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

    const scenarioReset = getScenarioPresetById(preset)
      ? await deleteScenarioUserInstructionFromBackend(preset, { silent: true })
      : { ok: true, skipped: true };
    if (!scenarioReset.ok && !scenarioReset.skipped) {
      push("WARN: scenario instruction reset failed; local remains authoritative");
    }

    const sync = await syncInstructionsToBackend(target, payload.current, { silent: true });
    if (instrStatusEl) {
      instrStatusEl.textContent = sync.ok
        ? ((scenarioReset.ok || scenarioReset.skipped) ? "Reset (local) + synced" : "Reset (local) + synced (scenario reset failed)")
        : "Reset (local) (sync failed)";
    }
    if (!sync.ok) push("WARN: backend sync failed; local remains authoritative");
    renderScenarioCards();
    updateVoiceScenarioUI();
    return;
  }

  applyTargetDocToEditor(target, "Reset", { silent: true });
  try {
    const scenarioReset = getScenarioPresetById(preset)
      ? await deleteScenarioUserInstructionFromBackend(preset, { silent: true })
      : { ok: true, skipped: true };
    if (!scenarioReset.ok && !scenarioReset.skipped) {
      push("WARN: scenario instruction reset failed");
    }

    const sync = await syncInstructionsToBackend(target, payload.current, { silent: false });
    if (instrStatusEl) {
      instrStatusEl.textContent = sync.ok
        ? ((scenarioReset.ok || scenarioReset.skipped) ? "Reset + synced" : "Reset + synced (scenario reset failed)")
        : "Reset (sync failed)";
    }
    renderScenarioCards();
    updateVoiceScenarioUI();
  } catch {
    if (instrStatusEl) instrStatusEl.textContent = "Reset (network error)";
  }
}

async function refreshInstructionsPage() {
  const target = setInstrTarget("realtime");
  if (instrBackendEl) instrBackendEl.textContent = getBackendLabelForTarget(target);

  try {
    await fetchScenariosFromBackend();
    renderScenarioPresetDropdown();
    updateVoiceScenarioUI();
  } catch (e) {
    scenarioPresetStore = {
      version: 0,
      defaultScenarioId: "",
      activeScenarioId: "",
      scenarios: [],
      byId: {},
      source: "",
      defaultSource: "",
    };
    renderScenarioPresetDropdown();
    updateVoiceScenarioUI();
    push(`WARN: scenario presets fetch failed: ${e?.message || e}`);
  }

  await loadInstructionStoreEffective({ silent: true });
  applyTargetDocToEditor(target, "Loaded (local)", { silent: true });
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
if (instrCurrentEl) instrCurrentEl.addEventListener("input", () => updateScenarioInstructionsUI());
if (btnRepeatLastAnswer) {
  btnRepeatLastAnswer.addEventListener("click", () => {
    if (!rtWs || rtWs.readyState !== WebSocket.OPEN) {
      push("WARN: Realtime WS not connected; cannot repeat last answer.");
      return;
    }

    try {
      rtWs.send(JSON.stringify({
        type: "repeat_last_answer"
      }));

      push("Repeat Last Answer sent to realtime session.");
    } catch (e) {
      push(`ERROR: Repeat Last Answer failed: ${e?.message || e}`);
    }
  });
}

if (btnInstrRefresh) {
  btnInstrRefresh.addEventListener("click", async () => {
    if (!rtWs || rtWs.readyState !== WebSocket.OPEN) {
      push("WARN: Realtime WS not connected; cannot refresh instructions.");
      return;
    }

    try {
      await syncInstructionsToBackend("realtime", (instrCurrentEl?.value || "").toString(), { silent: true });
      rtWs.send(JSON.stringify({
        type: "refresh_instructions"
      }));

      push("Refresh Instructions sent to realtime session.");
    } catch (e) {
      push(`ERROR: Instruction refresh failed: ${e?.message || e}`);
    }
  });
}
if (btnInstrRefreshProxyEls && btnInstrRefreshProxyEls.length) {
  for (const btn of btnInstrRefreshProxyEls) {
    btn.addEventListener("click", () => {
      if (btnInstrRefresh) btnInstrRefresh.click();
    });
  }
}

localeScenarioUiReady = true;
applyLocale();
loadLocaleCatalogs().then(() => applyLocale()).catch(() => {});

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
  let lastTestedOutputFingerprint = "";
  function buildOutputDeviceFingerprint(device) {
    if (!device) return "";
    const deviceId = (device.deviceId || "").toString().trim();
    const label = (device.label || "").toString().trim();
    return `${deviceId}|${label}`;
  }
  function loadAudioSafetyRecord() {
    try {
      const raw = localStorage.getItem(LS_AUDIO_SAFETY_RECORD);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && typeof record === "object" ? record : null;
    } catch {
      return null;
    }
  }
  function saveAudioSafetyRecord(record) {
    try {
      localStorage.setItem(LS_AUDIO_SAFETY_RECORD, JSON.stringify(record));
    } catch {}
  }
  function clearAudioSafetyRecord() {
    try { localStorage.removeItem(LS_AUDIO_SAFETY_RECORD); } catch {}
  }
  function findOutputById(outputs, deviceId) {
    const id = (deviceId || "").toString().trim();
    if (!id || !Array.isArray(outputs)) return null;
    return outputs.find((d) => d.deviceId === id) || null;
  }
  function outputMatchesSafetyRecord(device, record) {
    if (!device || !record || record.confirmed !== true) return false;
    const deviceId = (device.deviceId || "").toString().trim();
    const label = (device.label || "").toString().trim();
    const recordDeviceId = (record.deviceId || "").toString().trim();
    const recordLabel = (record.label || "").toString().trim();
    const recordFingerprint = (record.fingerprint || "").toString().trim();
    return (
      deviceId === recordDeviceId &&
      label === recordLabel &&
      buildOutputDeviceFingerprint(device) === recordFingerprint
    );
  }
  function isSafeHeadphonesDevice(device) {
    return !!device && isHeadphonesLabel(device.label);
  }
  function getSelectedOutputDevice(outputs) {
    const deviceId = (rtDeviceSel?.value || "").toString().trim();
    return findOutputById(outputs, deviceId);
  }
  function getExplicitSelectedOutputDevice(outputs) {
    const deviceId = (rtDeviceSel?.value || "").toString().trim();
    if (!deviceId) return null;
    return findOutputById(outputs, deviceId);
  }
  function setAudioSafetyMessage(message, state) {
    if (!audioSafetyMessageEl) return;
    audioSafetyMessageEl.textContent = message || "";
    audioSafetyMessageEl.classList.remove("ok", "warn", "bad");
    if (state) audioSafetyMessageEl.classList.add(state);
  }
  function getAudioSafetyState(outputs) {
    const resolved = resolveSafeRealtimeOutput(outputs);
    if (resolved.ok) return { safe: true, ...resolved };
    return {
      safe: false,
      source: "none",
      deviceId: "",
      label: "",
      reason: resolved.reason || "not-confirmed",
    };
  }
  function updateAudioSafetyUi(outputs) {
    const state = getAudioSafetyState(outputs);
    if (audioSafetyStatusEl) {
      audioSafetyStatusEl.textContent =
        state.source === "headphones-detected" ? "Status: Headphones detected" :
        state.source === "user-confirmed" ? "Status: Confirmed" :
        "Status: Not confirmed";
    }
    if (audioSafetyMessageEl) {
      audioSafetyMessageEl.classList.remove("ok", "warn", "bad");
      if (state.source === "headphones-detected") {
        audioSafetyMessageEl.textContent = "Headphones output detected. Realtime voice can use this output.";
        audioSafetyMessageEl.classList.add("ok");
      } else if (state.source === "user-confirmed") {
        audioSafetyMessageEl.textContent = "This output was confirmed for headphones.";
        audioSafetyMessageEl.classList.add("ok");
      } else {
        audioSafetyMessageEl.textContent = "Select an output device, test it, then confirm it plays only in headphones.";
        audioSafetyMessageEl.classList.add("warn");
      }
    }
    if (btnConfirmHeadphonesOutput) {
      btnConfirmHeadphonesOutput.disabled = !getExplicitSelectedOutputDevice(outputs);
    }
    if (btnResetAudioSafety) {
      btnResetAudioSafety.disabled = !loadAudioSafetyRecord();
    }
  }
  function loadSavedRtDeviceId() {
    try { return (localStorage.getItem(LS_RT_DEVICE_ID) || "").trim(); } catch { return ""; }
  }
  function loadPreferredRtLabel() {
    try { return (localStorage.getItem(LS_RT_DEVICE_PREFERRED_LABEL) || "").trim(); } catch { return ""; }
  }
  function resolveSafeRealtimeOutput(outputs) {
    const list = Array.isArray(outputs) ? outputs : [];
    const selected = getSelectedOutputDevice(list);
    const record = loadAudioSafetyRecord();
    const savedConfirmed = list.find((d) => outputMatchesSafetyRecord(d, record)) || null;
    const savedRtDevice = findOutputById(list, loadSavedRtDeviceId());
    const preferredLabel = loadPreferredRtLabel();
    const preferredDevice = preferredLabel
      ? list.find((d) => (d.label || "").trim() === preferredLabel)
      : null;
    const firstHeadphones = list.find((d) => isSafeHeadphonesDevice(d)) || null;

    if (selected && isSafeHeadphonesDevice(selected)) {
      return {
        ok: true,
        deviceId: selected.deviceId || "",
        label: selected.label || "",
        source: "headphones-detected",
        reason: "selected-headphones",
      };
    }
    if (selected && outputMatchesSafetyRecord(selected, record)) {
      return {
        ok: true,
        deviceId: selected.deviceId || "",
        label: selected.label || "",
        source: "user-confirmed",
        reason: "selected-confirmed",
      };
    }
    if (savedConfirmed) {
      return {
        ok: true,
        deviceId: savedConfirmed.deviceId || "",
        label: savedConfirmed.label || "",
        source: "user-confirmed",
        reason: "saved-confirmed",
      };
    }
    if (savedRtDevice && isSafeHeadphonesDevice(savedRtDevice)) {
      return {
        ok: true,
        deviceId: savedRtDevice.deviceId || "",
        label: savedRtDevice.label || "",
        source: "headphones-detected",
        reason: "saved-headphones",
      };
    }
    if (preferredDevice && isSafeHeadphonesDevice(preferredDevice)) {
      return {
        ok: true,
        deviceId: preferredDevice.deviceId || "",
        label: preferredDevice.label || "",
        source: "headphones-detected",
        reason: "preferred-label-headphones",
      };
    }
    if (firstHeadphones) {
      return {
        ok: true,
        deviceId: firstHeadphones.deviceId || "",
        label: firstHeadphones.label || "",
        source: "headphones-detected",
        reason: "first-headphones",
      };
    }
    return {
      ok: false,
      deviceId: "",
      label: "",
      source: "none",
      reason: selected ? "selected-output-not-confirmed" : "no-safe-output",
    };
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
  function currentOutputLabel() {
    const selected = rtDeviceSel?.options?.[rtDeviceSel.selectedIndex]?.textContent || "";
    const saved = (() => {
      try { return (localStorage.getItem(LS_RT_DEVICE_LABEL) || "").trim(); } catch { return ""; }
    })();
    const label = (selected && selected !== "(auto)") ? selected : saved;
    return label || t("common.notSelected", "Not selected");
  }
  function updateOutputSummaryUi() {
    const label = currentOutputLabel();
    const notSelected = t("common.notSelected", "Not selected");
    if (bottomOutputEl) bottomOutputEl.textContent = label === notSelected ? notSelected : t("common.ready", "Ready");
    if (settingsOutputDeviceTextEl) settingsOutputDeviceTextEl.textContent = label;
    if (settingsDiagOutputEl) settingsDiagOutputEl.textContent = label === notSelected ? notSelected : t("common.ready", "Ready");
    if (settingsOutputBadgeEl) setSettingsBadge(settingsOutputBadgeEl, label === notSelected ? "warn" : "ok", label === notSelected ? notSelected : t("common.outputReady", "Output Ready"));
  }
  async function refreshOutputDevicesUI() {
    const outputs = await enumerateAudioOutputs();
    const current = (rtDeviceSel.value || "").trim();
    const safetyRecord = loadAudioSafetyRecord();
    const savedConfirmed = outputs.find((d) => outputMatchesSafetyRecord(d, safetyRecord)) || null;
    const saved = loadSavedRtDeviceId();
    const firstHeadphones = outputs.find((d) => isSafeHeadphonesDevice(d)) || null;
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
    } else if (savedConfirmed) {
      rtDeviceSel.value = savedConfirmed.deviceId;
    } else if (saved && outputs.some((o) => o.deviceId === saved)) {
      rtDeviceSel.value = saved;
    } else if (firstHeadphones) {
      rtDeviceSel.value = firstHeadphones.deviceId;
    } else {
      rtDeviceSel.value = "";
    }
    updateOutputSummaryUi();
    updateAudioSafetyUi(outputs);
    push(`Audio outputs detected: ${outputs.length}`);
    return outputs;
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
      updateOutputSummaryUi();
      updateAudioSafetyUi([]);
      return false;
    }
    const outputs = await enumerateAudioOutputs();
    const safe = resolveSafeRealtimeOutput(outputs);
    if (!safe.ok) {
      push(`ERROR: Realtime sink safety blocked. No safe output is available (${safe.reason}). Select, test, and confirm a headphones-routed output before starting Direct Realtime.`);
      updateOutputSummaryUi();
      updateAudioSafetyUi(outputs);
      return false;
    }
    try {
      await rtOutEl.setSinkId(safe.deviceId);
      // Update UI selection if possible
      if (safe.deviceId && outputs.some((o) => o.deviceId === safe.deviceId)) {
        rtDeviceSel.value = safe.deviceId;
      }
      const label = safe.label || getOutputLabelById(outputs, safe.deviceId) || safe.deviceId;
      saveRtDeviceSelection(safe.deviceId, label);
      lastAppliedSinkId = safe.deviceId;
      updateOutputSummaryUi();
      updateAudioSafetyUi(outputs);
      push(`Realtime output sink set to: ${label}`);
      return true;
    } catch (e) {
      const msg = e?.message || e;
      push(`ERROR: setSinkId failed: ${msg}`);
      updateOutputSummaryUi();
      updateAudioSafetyUi(outputs);
      return false;
    }
  }
  async function testSelectedOutput() {
    const outputs = await enumerateAudioOutputs();
    const device = getExplicitSelectedOutputDevice(outputs);
    if (!device) {
      setAudioSafetyMessage("Select an output device before testing.", "warn");
      return false;
    }
    if (typeof rtOutEl.setSinkId !== "function") {
      setAudioSafetyMessage("Audio output routing is not supported in this Electron build.", "bad");
      return false;
    }

    try {
      await rtOutEl.setSinkId(device.deviceId);
    } catch (e) {
      setAudioSafetyMessage(`Audio output routing failed: ${e?.message || e}`, "bad");
      return false;
    }

    if (!playbackCtx) {
      playbackCtx = new AudioContext({ sampleRate: 24000 });
      push(`Playback AudioContext sampleRate=${playbackCtx.sampleRate}`);
    }
    if (!playbackGainNode) {
      playbackGainNode = playbackCtx.createGain();
      playbackGainNode.gain.value = playbackVolume;
    }
    if (!playbackDest) {
      playbackDest = playbackCtx.createMediaStreamDestination();
    }
    try {
      playbackGainNode.connect(playbackDest);
    } catch {}

    rtOutEl.srcObject = playbackDest.stream;
    try { await rtOutEl.play(); } catch {}
    try {
      if (playbackCtx.state === "suspended") await playbackCtx.resume();
    } catch {}

    const osc = playbackCtx.createOscillator();
    const toneGain = playbackCtx.createGain();
    const startAt = playbackCtx.currentTime + 0.02;
    const stopAt = startAt + 0.4;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, startAt);
    toneGain.gain.setValueAtTime(0.0001, startAt);
    toneGain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03);
    toneGain.gain.setValueAtTime(0.18, stopAt - 0.05);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    osc.connect(toneGain);
    toneGain.connect(playbackGainNode || playbackDest);
    osc.start(startAt);
    osc.stop(stopAt + 0.02);

    lastTestedOutputFingerprint = buildOutputDeviceFingerprint(device);
    saveRtDeviceSelection(device.deviceId, device.label || "");
    updateOutputSummaryUi();
    updateAudioSafetyUi(outputs);
    setAudioSafetyMessage("Test sound played. If you heard it only in headphones, click Confirm.", "warn");
    push(`Audio safety test sound played through: ${device.label || device.deviceId}`);
    return true;
  }
  async function confirmSelectedOutputUsesHeadphones() {
    const outputs = await enumerateAudioOutputs();
    const device = getExplicitSelectedOutputDevice(outputs);
    if (!device) {
      setAudioSafetyMessage("Select an output device before confirming.", "warn");
      return false;
    }
    const fingerprint = buildOutputDeviceFingerprint(device);
    if (fingerprint !== lastTestedOutputFingerprint) {
      setAudioSafetyMessage("Test this selected output before confirming.", "warn");
      return false;
    }

    saveAudioSafetyRecord({
      confirmed: true,
      source: "user-confirmed",
      deviceId: device.deviceId || "",
      label: device.label || "",
      fingerprint,
      confirmedAt: new Date().toISOString(),
    });
    saveRtDeviceSelection(device.deviceId, device.label || "");
    updateOutputSummaryUi();
    updateAudioSafetyUi(outputs);
    refreshButtons();
    setAudioSafetyMessage("Output confirmed for headphones.", "ok");
    push(`Audio output confirmed for headphones: ${device.label || device.deviceId}`);
    return true;
  }
  async function resetAudioSafetyConfirmation() {
    clearAudioSafetyRecord();
    lastTestedOutputFingerprint = "";
    const outputs = await enumerateAudioOutputs();
    updateAudioSafetyUi(outputs);
    refreshButtons();
    setAudioSafetyMessage("Audio output confirmation reset.", "warn");
    push("Audio output safety confirmation reset.");
  }
  // Auto re-bind on device changes (debounced)
  let deviceChangeTimer = null;
  function onDeviceChange() {
    if (deviceChangeTimer) window.clearTimeout(deviceChangeTimer);
    deviceChangeTimer = window.setTimeout(async () => {
      deviceChangeTimer = null;
      push("Device change detected (audio outputs may have changed). Re-applying Realtime sink...");
      try {
        const outputs = await refreshOutputDevicesUI();
        const safe = resolveSafeRealtimeOutput(outputs);
        if (!safe.ok) {
          updateAudioSafetyUi(outputs);
          if (directRealtimeActive || directRealtimeStarting) {
            push(`WARN: Safe audio output is no longer available (${safe.reason}). Stopping Direct Realtime.`);
            try { stopAudioNow(); } catch {}
            await stopDirectRealtime({ closeRealtime: true });
          } else {
            push(`WARN: Safe audio output is not available (${safe.reason}). Direct Realtime remains blocked.`);
          }
          return;
        }
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
    setAssistantSpeaking(false);
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
  // Realtime WS
  // ------------------------------
  async function connectRealtime() {
    if (rtWs && (rtWs.readyState === WebSocket.OPEN || rtWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const { VOICE_WS, REALTIME_RATE } = directRealtimeCfg();
    const playbackReady = await ensurePlayback();
    if (!playbackReady) {
      setRealtimeStatus("OFF");
      refreshButtons();
      return;
    }
    rtWs = new WebSocket(VOICE_WS);
    setRealtimeStatus("RECONNECTING");
    rtWs.onopen = () => {
      setRealtimeStatus("ON");
      push(`Voice WS connected (rate=${REALTIME_RATE})`);
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
      setAssistantSpeaking(false);
      setListeningIndicator(false);
      refreshButtons();
      if (directRealtimeActive || directRealtimeStarting) {
        stopDirectRealtime({ closeRealtime: false, silent: true }).catch(() => {});
        push("Direct Realtime stopped because Voice WS closed.");
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
        setAssistantSpeaking(true);
        playPcm16(pcm16, msg.sample_rate || 24000, msg.channels || 1);
        return;
      }
      if (msg.type === "log") {
        push(msg.message || JSON.stringify(msg));
        const logText = String(msg.event || msg.message || "");
        if (logText.includes("input_audio_buffer.speech_started")) {
          directLastSpeechStartedAt = Date.now();
          setListeningIndicator(true);
          const hasAssistantAudio =
            isAssistantSpeaking ||
            activePlaybackSources.size > 0 ||
            audioQueue.length > 0 ||
            bufferedBytes > 0;
          if (hasAssistantAudio) {
            stopAudioNow();
            try { rtWs.send(JSON.stringify({ type: "response.cancel" })); } catch {}
            setAssistantSpeaking(false);
            push("Barge-in detected: cancelled current response and stopped local playback");
          }
        }
        if (logText.includes("input_audio_buffer.speech_stopped")) {
          setListeningIndicator(false);
        }
        return;
      }
      if (msg.type === "error") {
        push(`ERROR(Realtime): ${msg.message || "unknown error"}`);
        return;
      }
      if (msg.type === "agent_done") {
        setAssistantSpeaking(false);
        if (directRealtimeActive || directRealtimeStarting) {
          push("Direct Realtime response done");
          return;
        }
        push("Realtime response done");
      }
    };
  }
  // ------------------------------
  // Direct Realtime loopback
  // ------------------------------
  let directRealtimeActive = false;
  let directRealtimeStarting = false;
  let directStream = null;
  let directCtx = null;
  let directSource = null;
  let directNode = null;
  let directAudioChunks = [];
  let directAudioBytes = 0;
  let directFramePending = [];
  let directSessionStartedAt = 0;
  let directLastSpeechStartedAt = 0;
  let costGuardTimer = null;
  let costGuardLastIdleWarnAt = 0;
  let costGuardLastMaxWarnAt = 0;
  const DIRECT_PCM_CHUNK_BYTES = 960; // 20ms @ 24kHz mono PCM16
  const DIRECT_FRAME_PENDING_LIMIT = 80;
  function readCostGuardMinutes(selectEl) {
    const n = Number(selectEl?.value || "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function showCostGuardNotice(message, level) {
    if (!costGuardNoticeEl) return;
    costGuardNoticeEl.textContent = message || "";
    costGuardNoticeEl.classList.remove("bad");
    if (level === "bad") costGuardNoticeEl.classList.add("bad");
    costGuardNoticeEl.classList.add("active");
  }

  function clearCostGuardNotice() {
    if (!costGuardNoticeEl) return;
    costGuardNoticeEl.textContent = "";
    costGuardNoticeEl.classList.remove("active", "bad");
  }

  function stopCostGuardTimer() {
    try { if (costGuardTimer) window.clearInterval(costGuardTimer); } catch {}
    costGuardTimer = null;
    costGuardLastIdleWarnAt = 0;
    costGuardLastMaxWarnAt = 0;
  }

  function checkCostGuard() {
    if (!directRealtimeActive) return;

    const idleMinutes = readCostGuardMinutes(idleGuardMinutesEl);
    const maxMinutes = readCostGuardMinutes(maxSessionMinutesEl);
    const now = Date.now();
    const warnEnabled = idleGuardWarnEl?.checked !== false;

    if (idleMinutes > 0 && directLastSpeechStartedAt > 0) {
      const idleMs = now - directLastSpeechStartedAt;
      const idleLimitMs = idleMinutes * 60 * 1000;

      if (idleMs >= idleLimitMs) {
        const message = `Session stopped by Cost Guard: idle limit reached (${idleMinutes} min).`;
        push(message);
        showCostGuardNotice(message, "bad");
        stopDirectRealtime({ closeRealtime: true }).catch((e) => push(`ERROR(Session Cost Guard stop): ${e?.message || e}`));
        return;
      }
      if (warnEnabled && idleMs >= Math.max(0, idleLimitMs - 30000) && now - costGuardLastIdleWarnAt > 30000) {
        costGuardLastIdleWarnAt = now;
        const message = `Session Cost Guard: idle limit approaching (${idleMinutes} min).`;
        push(message);
        showCostGuardNotice(message, "warn");
      }
    }

    if (maxMinutes > 0 && directSessionStartedAt > 0) {
      const sessionMs = now - directSessionStartedAt;
      const maxLimitMs = maxMinutes * 60 * 1000;

      if (sessionMs >= maxLimitMs) {
        const message = `Session stopped by Cost Guard: max session duration reached (${maxMinutes} min).`;
        push(message);
        showCostGuardNotice(message, "bad");
        stopDirectRealtime({ closeRealtime: true }).catch((e) => push(`ERROR(Session Cost Guard stop): ${e?.message || e}`));
        return;
      }
      if (warnEnabled && sessionMs >= Math.max(0, maxLimitMs - 30000) && now - costGuardLastMaxWarnAt > 30000) {
        costGuardLastMaxWarnAt = now;
        const message = `Session Cost Guard: max session limit approaching (${maxMinutes} min).`;
        push(message);
        showCostGuardNotice(message, "warn");
      }
    }
  }

  function startCostGuardTimer() {
    stopCostGuardTimer();
    costGuardTimer = window.setInterval(checkCostGuard, 5000);
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
    const label = text || (on ? "DIRECT: ON" : "DIRECT: OFF");
    setPill("sttStatus", on ? "ok" : "bad", label);
    if (on) setSessionStatus("ON");
    else if (label === "DIRECT: STARTING") setSessionStatus("STARTING");
    else setSessionStatus("OFF");
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
  async function startDirectRealtime() {
    if (directRealtimeActive || directRealtimeStarting) {
      push("Direct Realtime is already running.");
      return;
    }

    // Licensing enforcement is intentionally disabled during current development/packaging validation.
    // License UI remains active, but Start Direct Realtime is not license-gated yet.

    directRealtimeStarting = true;
    clearCostGuardNotice();
    directSessionStartedAt = Date.now();
    directLastSpeechStartedAt = directSessionStartedAt;
    setDirectStatusOn(false, "DIRECT: STARTING");
    refreshButtons();

    try {
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
      startCostGuardTimer();
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
    stopCostGuardTimer();
    setAssistantSpeaking(false);
    setListeningIndicator(false);
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

    if (closeRealtime) {
      desiredConnected = false;
      clearReconnectTimers();
      try { if (rtPingTimer) window.clearInterval(rtPingTimer); } catch {}
      rtPingTimer = null;
      const ws = rtWs;
      rtWs = null;
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        try { ws.close(1000, "direct-realtime-stop"); } catch {}
      }
      setRealtimeStatus("OFF");
    }

    setDirectStatusOn(false);
    refreshButtons();
    if (!silent && wasRunning) push("Direct Realtime stopped.");
  }
  function refreshButtons() {
    const rtOk = rtWs && rtWs.readyState === WebSocket.OPEN;
    const directBusy = directRealtimeActive || directRealtimeStarting;
    // Pause/Resume button is enabled only when Voice WS is open.
    if (btnPauseAudio) {
      btnPauseAudio.disabled = !rtOk;
    }
    $("btnStart").disabled = directBusy;
    $("btnStop").disabled = !directBusy;
    publishMiniControlStatus();
  }
  // ------------------------------
  // Reset Session (Ready state; user clicks Connect)
  // ------------------------------
  async function resetSessionToReady() {
    push("Reset session requested...");
    if (directRealtimeActive || directRealtimeStarting) {
      push("Reset session skipped because Direct Realtime is running. Stop Direct Realtime first to create a new session.");
      refreshButtons();
      return;
    }
    desiredConnected = false;
    clearReconnectTimers();
    clearPingTimers();
    try { await stopDirectRealtime({ closeRealtime: true, silent: true }); } catch {}
    try { rtWs?.close(1000, "reset"); } catch {}
    rtWs = null;
    rtReconnectAttempt = 0;
    setAssistantSpeaking(false);
    setListeningIndicator(false);
    sid =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : ("test-" + Math.random().toString(16).slice(2));
    $("sid").textContent = sid;
    setDirectStatusOn(false);
    setRealtimeStatus("OFF");
    refreshButtons();
    push(`Session reset complete. New sessionId=${sid}. Ready for Direct Realtime.`);
  }
  // ------------------------------
  // UI wiring (Settings page)
  // ------------------------------
  function markSettingsSaved(msg) {
    if (!settingsSaved) return;
    settingsSaved.textContent = msg || t("common.saved", "Saved");
    window.setTimeout(() => {
      try { settingsSaved.textContent = ""; } catch {}
    }, 1500);
  }
  function saveSettingsFromInputs() {
    saveStrLS(LS_RT_HTTP, $("rtHttp").value.trim());
    saveStrLS(LS_RT_WS, $("rtWs").value.trim());
    saveStrLS(LS_REALTIME_RATE, normalizeRealtimeRate((realtimeRateEl?.value || "").toString()));
    saveStrLS(LS_IDLE_GUARD_MINUTES, (idleGuardMinutesEl?.value || "0").toString());
    saveStrLS(LS_IDLE_GUARD_WARN, idleGuardWarnEl?.checked ? "1" : "0");
    saveStrLS(LS_MAX_SESSION_MINUTES, (maxSessionMinutesEl?.value || "0").toString());
    saveStrLS(LS_DISPLAY_LANGUAGE, getDisplayLanguage());
    updateEndpointSummaryUi();
    updateCostGuardSummaryUi();
    markSettingsSaved(t("common.saved", "Saved"));
  }
  function resetSettingsToDefaults() {
    saveStrLS(LS_RT_HTTP, "");
    saveStrLS(LS_RT_WS, "");
    saveStrLS(LS_REALTIME_RATE, "");
    saveStrLS(LS_IDLE_GUARD_MINUTES, "");
    saveStrLS(LS_IDLE_GUARD_WARN, "");
    saveStrLS(LS_MAX_SESSION_MINUTES, "");
    loadEndpointSettingsIntoInputs();
    loadVoiceSettingsIntoInputs();
    loadCostGuardSettingsIntoInputs();
    markSettingsSaved(t("common.resetToDefaults", "Reset to defaults"));
  }
  function applyLocalBackendPreset() {
    $("rtHttp").value = LOCAL_BACKEND_PRESET.REALTIME_HTTP;
    $("rtWs").value = LOCAL_BACKEND_PRESET.REALTIME_WS;
    updateEndpointSummaryUi();
    push("Local backend endpoint preset applied. Click Save settings.");
  }
  if (btnUpdateCheck) btnUpdateCheck.addEventListener("click", () => {
    renderUpdateState({ status: "update-not-available" });
    push("Update check skipped: no update feed configured. Showing up-to-date status.");
  });
  if (btnUpdateDownload) btnUpdateDownload.addEventListener("click", () => {
    runUpdateAction("download", (updates) => updates.download());
  });
  if (btnUpdateRestart) btnUpdateRestart.addEventListener("click", () => {
    runUpdateAction("restart", (updates) => updates.quitAndInstall());
  });
  if (licenseEmailEl) licenseEmailEl.addEventListener("input", updateLicenseButtons);
  if (licenseKeyEl) licenseKeyEl.addEventListener("input", updateLicenseButtons);
  if (btnLicenseStartTrial) {
    btnLicenseStartTrial.addEventListener("click", () => {
      const email = (licenseEmailEl?.value || "").toString().trim();
      updateLicenseButtons();
      if (!email) return;
      runLicenseAction("start trial", (license) => license.startTrial({ email }));
    });
  }
  if (btnLicenseActivate) {
    btnLicenseActivate.addEventListener("click", () => {
      const email = (licenseEmailEl?.value || "").toString().trim();
      const licenseKey = (licenseKeyEl?.value || "").toString().trim();
      updateLicenseButtons();
      if (!licenseKey) return;

      runLicenseAction("activate", (license) => license.activate({ email, licenseKey }))
        .finally(() => {
          if (licenseKeyEl) licenseKeyEl.value = "";
          updateLicenseButtons();
        });
    });
  }
  if (btnLicenseValidate) {
    btnLicenseValidate.addEventListener("click", () => {
      runLicenseAction("validate", (license) => license.validate());
    });
  }
  if (btnLicenseCheckout) {
    btnLicenseCheckout.addEventListener("click", () => {
      runLicenseAction("checkout", (license) => license.openCheckout());
    });
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
  if (displayLanguageEl) {
    displayLanguageEl.addEventListener("change", () => {
      setDisplayLanguage(displayLanguageEl.value);
    });
  }
  if (headerDisplayLanguageEl) {
    headerDisplayLanguageEl.addEventListener("change", () => {
      setDisplayLanguage(headerDisplayLanguageEl.value);
    });
  }
  for (const el of [idleGuardMinutesEl, idleGuardWarnEl, maxSessionMinutesEl]) {
    if (!el) continue;
    el.addEventListener("change", updateCostGuardSummaryUi);
  }
  if (providerActiveEl) {
    providerActiveEl.addEventListener("change", () => {
      if (directRealtimeActive || directRealtimeStarting) {
        setProviderStatus("Stop Direct Realtime before changing provider.");
        providerActiveEl.value = providerConfigState?.activeProvider || providerCapabilitiesState?.defaultProvider || "azure-openai-realtime";
        applyProviderUi(providerActiveEl.value);
        return;
      }

      applyProviderUi(getSelectedProviderId());
      updateProviderSummaryUi();
      setProviderStatus("Provider changed. Save provider to persist.");
    });
  }

  for (const el of [providerModelEl, providerVoiceEl, providerOutgoingLanguageEl]) {
    if (!el) continue;
    el.addEventListener("change", updateProviderSummaryUi);
    el.addEventListener("input", updateProviderSummaryUi);
  }

  if (btnProviderSave) {
    btnProviderSave.addEventListener("click", async () => {
      if (directRealtimeActive || directRealtimeStarting) {
        setProviderStatus("Stop Direct Realtime before saving provider settings.");
        return;
      }

      try {
        const c = directRealtimeCfg();
        const payload = buildProviderConfigFromUi();
        const res = await fetch(`${c.REALTIME_HTTP}/v1/provider/config`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        providerConfigState = await res.json();
        applyProviderUi(providerConfigState.activeProvider);
        setProviderStatus("Provider config saved");
      } catch (e) {
        setProviderStatus(`Provider save failed: ${e?.message || e}`);
      }
    });
  }

  if (btnProviderTest) {
    btnProviderTest.addEventListener("click", async () => {
      try {
        const c = directRealtimeCfg();
        const payload = buildProviderConfigFromUi();
        const res = await fetch(`${c.REALTIME_HTTP}/v1/provider/test`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

        if (data?.ok) {
          setProviderStatus("Provider test passed");
        } else {
          const missing = Array.isArray(data?.missing) ? data.missing.join(", ") : "";
          setProviderStatus(missing ? `Provider test incomplete: missing ${missing}` : "Provider test incomplete");
        }
      } catch (e) {
        setProviderStatus(`Provider test failed: ${e?.message || e}`);
      }
    });
  }

  // Realtime rate
async function reconnectVoiceWs(reason) {
  if (!desiredConnected) return;
  try {
    setAssistantSpeaking(false);
    setListeningIndicator(false);
    rtReconnectSuppressOnce = true;
    try { rtWs?.close(1000, reason || "reconfigure"); } catch {}
    rtWs = null;
    // Connect immediately with the new config.
    await connectRealtime();
    refreshButtons();
  } catch (e) {
    push(`WARN: Realtime WS reconnect failed: ${e?.message || e}`);
  }
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
    await reconnectVoiceWs("rate-change");
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
    await reconnectVoiceWs("rate-change");
  });
}
if (playbackVolumeEl) {
  playbackVolumeEl.addEventListener("input", () => {
    applyPlaybackVolume(playbackVolumeEl.value);
  });
}

  // Auth token UI
  function setAuthStatus() {
    const token = getAuthToken();
    setSettingsBadge(authStatusEl, token ? "ok" : "warn", token ? t("common.tokenSet", "Token set") : t("common.noToken", "No token"));
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
    lastTestedOutputFingerprint = "";
    const outputs = await enumerateAudioOutputs();
    const deviceId = (rtDeviceSel.value || "").trim();
    const label =
      (deviceId ? outputs.find((d) => d.deviceId === deviceId)?.label : "") ||
      (deviceId ? rtDeviceSel.options[rtDeviceSel.selectedIndex]?.textContent : "") ||
      "";
    saveRtDeviceSelection(deviceId, label);
    updateAudioSafetyUi(outputs);
    await applyRealtimeSink();
  });
  if (btnTestSelectedOutput) {
    btnTestSelectedOutput.addEventListener("click", async () => {
      try {
        await testSelectedOutput();
      } catch (e) {
        setAudioSafetyMessage(`Audio output test failed: ${e?.message || e}`, "bad");
        push(`ERROR(Audio safety test): ${e?.message || e}`);
      }
    });
  }
  if (btnConfirmHeadphonesOutput) {
    btnConfirmHeadphonesOutput.addEventListener("click", async () => {
      try {
        await confirmSelectedOutputUsesHeadphones();
      } catch (e) {
        setAudioSafetyMessage(`Audio output confirmation failed: ${e?.message || e}`, "bad");
        push(`ERROR(Audio safety confirm): ${e?.message || e}`);
      }
    });
  }
  if (btnResetAudioSafety) {
    btnResetAudioSafety.addEventListener("click", async () => {
      try {
        await resetAudioSafetyConfirmation();
      } catch (e) {
        setAudioSafetyMessage(`Audio output reset failed: ${e?.message || e}`, "bad");
        push(`ERROR(Audio safety reset): ${e?.message || e}`);
      }
    });
  }
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
      setDirectStatusOn(false);
      refreshButtons();
    }
  });
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
  function clickMainControlFromMini(buttonId, label) {
    const btn = document.getElementById(buttonId);
    if (!btn) {
      push(`WARN: Mini control command skipped; ${label} button was not found.`);
      return;
    }

    if (btn.disabled) {
      push(`WARN: Mini control command skipped; ${label} button is disabled.`);
      publishMiniControlStatus();
      return;
    }

    btn.click();
    setTimeout(publishMiniControlStatus, 250);
  }

  function handleMiniControlCommand(payload) {
    const command = typeof payload === "string" ? payload : payload && payload.command;

    if (command === "start") {
      clickMainControlFromMini("btnStart", "Start Direct Realtime");
    } else if (command === "stop") {
      clickMainControlFromMini("btnStop", "Stop Direct Realtime");
    } else if (command === "refresh") {
      clickMainControlFromMini("btnInstrRefresh", "Refresh Instructions");
    } else if (command === "repeat") {
      clickMainControlFromMini("btnRepeatLastAnswer", "Repeat Last Answer");
    } else if (command === "reset") {
      clickMainControlFromMini("btnResetSession", "Reset Session");
    } else {
      push(`WARN: Unsupported mini control command: ${command || "(empty)"}`);
      publishMiniControlStatus();
    }
  }

  try {
    const miniApi = window.electronAPI && window.electronAPI.miniControl;
    if (miniApi && typeof miniApi.onCommand === "function") {
      miniApi.onCommand(handleMiniControlCommand);
    }
    if (miniApi && typeof miniApi.onStatusRequest === "function") {
      miniApi.onStatusRequest(() => publishMiniControlStatus());
    }
    publishMiniControlStatus();
  } catch (_) {
    // ignore
  }

  window.addEventListener("beforeunload", () => {
    desiredConnected = false;
    clearReconnectTimers();
    clearPingTimers();
    setAssistantSpeaking(false);
    setListeningIndicator(false);
    try { stopDirectRealtime({ closeRealtime: false, silent: true }); } catch {}
    try { rtWs?.close(1000, "reset"); } catch {}
    rtWs = null;
    try {
      if (navigator?.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      }
    } catch {}
  });
  // Initial UI state
  setDirectStatusOn(false);
  setRealtimeStatus("OFF");
  setListeningIndicator(false);
  setSpeakingIndicator(false);
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
