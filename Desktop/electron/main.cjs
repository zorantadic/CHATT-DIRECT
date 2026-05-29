const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const { initMain } = require("electron-audio-loopback");

// Must be called before app is ready
initMain();

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

/**
 * FIX: Windows Chromium cache "Access is denied"
 * Force Electron userData + disk cache into a writable, project-local folder.
 * Must be set BEFORE app is ready.
 */
// Determine a writable userData directory.
// - In development we keep a project-local folder to avoid Chromium cache permission issues.
// - In packaged/installed builds we MUST use the per-user AppData folder (Program Files is not writable).
const defaultUserDataDir = app.getPath("userData");
const userDataDir = app.isPackaged
  ? defaultUserDataDir
  : path.join(__dirname, "..", ".electron-userdata");
const cacheDir = path.join(userDataDir, "Cache");
const logsDir = path.join(userDataDir, "logs");

try {
  ensureRuntimeDirectories();
} catch (_) {
  // ignore
}

app.setPath("userData", userDataDir);
// Chromium switches (more reliable across builds)
app.commandLine.appendSwitch("user-data-dir", userDataDir);
app.commandLine.appendSwitch("disk-cache-dir", cacheDir);

// ---- Local JSON persistence helpers (main-process) ----
function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      "[main] readJsonSafe failed:",
      filePath,
      err && err.message ? err.message : err
    );
    return null;
  }
}

function writeJsonAtomic(filePath, obj) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    console.error(
      "[main] writeJsonAtomic failed:",
      filePath,
      err && err.message ? err.message : err
    );
    return false;
  }
}

const instructionsPath = path.join(userDataDir, "instructions.json");
const legacyInstructionsPath = path.join(userDataDir, "instructions.local.json");
const providerConfigPath = path.join(userDataDir, "provider_config.local.json");
const scenarioPresetsLocalPath = path.join(userDataDir, "scenario_presets.local.json");
const licenseStatePath = path.join(userDataDir, "license_state.json");
const uiSettingsPath = path.join(userDataDir, "ui_settings.json");
const deviceSeedPath = path.join(userDataDir, "device_seed");
const backendInstallDir = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.join(__dirname, "..", "..", "backend");
const providerCapabilitiesPath = path.join(backendInstallDir, "provider_capabilities.json");
const providerConfigExamplePath = path.join(backendInstallDir, "provider_config.local.example.json");
const scenarioPresetsDefaultPath = path.join(backendInstallDir, "scenario_presets.json");
const backendPort = 50505;
const backendStdoutLogPath = path.join(logsDir, "backend.log");
const backendStderrLogPath = path.join(logsDir, "backend-error.log");
const LICENSE_API_BASE_URL = (
  process.env.LICENSE_API_BASE_URL ||
  "https://answerdesk-licensing-api-dev.azurewebsites.net/api"
).replace(/\/+$/, "");

let backendProcess = null;
let backendReady = false;
let backendStartError = null;
let isQuitting = false;
let backendStdoutLogStream = null;
let backendStderrLogStream = null;
let updateState = {
  status: "idle",
  checking: false,
  updateAvailable: false,
  downloaded: false,
  info: null,
  progress: null,
  error: null,
};

function ensureRuntimeDirectories() {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

function copyFileIfMissing(source, target) {
  if (fs.existsSync(target)) return true;
  if (!fs.existsSync(source)) return false;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    return true;
  } catch (err) {
    console.error(
      "[main] copyFileIfMissing failed:",
      source,
      "->",
      target,
      err && err.message ? err.message : err
    );
    return false;
  }
}

function ensureProviderConfigFile() {
  copyFileIfMissing(providerConfigExamplePath, providerConfigPath);
}

function ensureScenarioPresetsFile() {
  copyFileIfMissing(scenarioPresetsDefaultPath, scenarioPresetsLocalPath);
}

function buildBackendEnv() {
  return {
    ...process.env,
    PROVIDER_CONFIG_PATH: providerConfigPath,
    INSTRUCTIONS_PATH: instructionsPath,
    SCENARIO_PRESETS_PATH: scenarioPresetsLocalPath,
    PROVIDER_CAPABILITIES_PATH: providerCapabilitiesPath,
    PROVIDER_CONFIG_EXAMPLE_PATH: providerConfigExamplePath,
    SCENARIO_PRESETS_DEFAULT_PATH: scenarioPresetsDefaultPath,
    PORT: String(backendPort),
  };
}

function writeBackendLifecycleLog(stream, message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try { stream?.write(line); } catch (_) {}
}

function logBackendStartError(message) {
  if (backendStderrLogStream) {
    writeBackendLifecycleLog(backendStderrLogStream, message);
    return;
  }
  console.error(message);
}

function resolveBackendCommand() {
  if (app.isPackaged) {
    const backendRuntimeDir = path.join(process.resourcesPath, "backend-runtime");
    const backendExecutable = path.join(backendRuntimeDir, "chatt-backend.exe");

    if (!fs.existsSync(backendExecutable)) {
      backendReady = false;
      backendStartError = `Packaged backend executable not found: ${backendExecutable}`;
      logBackendStartError(`[main] ${backendStartError}`);
      return null;
    }

    return {
      cwd: backendRuntimeDir,
      command: backendExecutable,
      args: [],
    };
  }

  const venvPython = path.join(backendInstallDir, ".venv", "Scripts", "python.exe");
  return {
    cwd: backendInstallDir,
    command: fs.existsSync(venvPython) ? venvPython : "python",
    args: [
      "-m",
      "uvicorn",
      "app_realtime:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(backendPort),
      "--log-level",
      "info",
    ],
  };
}

function closeBackendLogStreams() {
  try { backendStdoutLogStream?.end(); } catch (_) {}
  try { backendStderrLogStream?.end(); } catch (_) {}
  backendStdoutLogStream = null;
  backendStderrLogStream = null;
}

function checkBackendReadiness() {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        path: "/",
        timeout: 1000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            const data = JSON.parse(body || "{}");
            resolve(data && data.status === "ok");
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("backend readiness timeout")));
    req.on("error", reject);
  });
}

async function hasHealthyExistingBackend() {
  try {
    return await checkBackendReadiness();
  } catch (_) {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollBackendReadiness() {
  const deadline = Date.now() + 15000;
  let lastError = null;

  while (!isQuitting && Date.now() < deadline) {
    try {
      if (await checkBackendReadiness()) {
        backendReady = true;
        backendStartError = null;
        writeBackendLifecycleLog(backendStdoutLogStream, "[main] backend ready");
        console.log("[main] backend ready");
        return true;
      }
    } catch (err) {
      lastError = err;
    }
    await delay(500);
  }

  backendReady = false;
  backendStartError = lastError && lastError.message
    ? `Backend readiness failed: ${lastError.message}`
    : "Backend readiness timed out";
  writeBackendLifecycleLog(backendStderrLogStream, `[main] ${backendStartError}`);
  console.warn("[main]", backendStartError);
  return false;
}

async function startBackend() {
  if (backendProcess) return;

  try {
    ensureRuntimeDirectories();
    ensureProviderConfigFile();
    ensureInstructionsFile();
    ensureScenarioPresetsFile();
    ensureLicenseStateFile();

    backendStdoutLogStream = fs.createWriteStream(backendStdoutLogPath, { flags: "a" });
    backendStderrLogStream = fs.createWriteStream(backendStderrLogPath, { flags: "a" });
    if (await hasHealthyExistingBackend()) {
      backendReady = true;
      backendStartError = null;
      backendProcess = null;
      const message = "[main] existing backend detected at http://127.0.0.1:50505/; using existing backend without spawning child process";
      writeBackendLifecycleLog(backendStdoutLogStream, message);
      console.log(message);
      closeBackendLogStreams();
      return;
    }

    const resolved = resolveBackendCommand();
    if (!resolved) {
      closeBackendLogStreams();
      return;
    }

    writeBackendLifecycleLog(
      backendStdoutLogStream,
      `[main] starting backend: ${resolved.command} ${resolved.args.join(" ")}`
    );

    const child = spawn(resolved.command, resolved.args, {
      cwd: resolved.cwd,
      env: buildBackendEnv(),
      windowsHide: true,
    });

    backendProcess = child;
    backendReady = false;
    backendStartError = null;

    child.stdout.on("data", (chunk) => {
      try { backendStdoutLogStream?.write(chunk); } catch (_) {}
      try { process.stdout.write(chunk); } catch (_) {}
    });
    child.stderr.on("data", (chunk) => {
      try { backendStderrLogStream?.write(chunk); } catch (_) {}
      try { process.stderr.write(chunk); } catch (_) {}
    });
    child.on("error", (err) => {
      backendReady = false;
      backendStartError = err && err.message ? err.message : String(err);
      writeBackendLifecycleLog(backendStderrLogStream, `[main] backend process error: ${backendStartError}`);
      console.error("[main] backend process error:", backendStartError);
      if (backendProcess === child) backendProcess = null;
      closeBackendLogStreams();
    });
    child.on("exit", (code, signal) => {
      const message = `[main] backend process exited code=${code} signal=${signal || ""}`;
      writeBackendLifecycleLog(backendStdoutLogStream, message);
      console.log(message);
      if (!isQuitting && code !== 0) {
        backendReady = false;
        backendStartError = message;
      }
      if (backendProcess === child) backendProcess = null;
      closeBackendLogStreams();
    });

    pollBackendReadiness().catch((err) => {
      backendReady = false;
      backendStartError = err && err.message ? err.message : String(err);
      writeBackendLifecycleLog(backendStderrLogStream, `[main] ${backendStartError}`);
      console.warn("[main]", backendStartError);
    });
  } catch (err) {
    backendReady = false;
    backendStartError = err && err.message ? err.message : String(err);
    writeBackendLifecycleLog(backendStderrLogStream, `[main] backend start failed: ${backendStartError}`);
    console.error("[main] backend start failed:", backendStartError);
    closeBackendLogStreams();
  }
}

function stopBackend() {
  if (!backendProcess) return;
  const child = backendProcess;
  backendProcess = null;
  backendReady = false;

  try {
    if (!child.killed) {
      writeBackendLifecycleLog(backendStdoutLogStream, "[main] stopping backend child process");
      child.kill();
    }
  } catch (err) {
    writeBackendLifecycleLog(
      backendStderrLogStream,
      `[main] backend stop failed: ${err && err.message ? err.message : err}`
    );
  }
}

function serializeUpdateError(err) {
  if (!err) return null;
  return {
    name: err.name || "Error",
    message: err.message || String(err),
    code: err.code || null,
  };
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
  };
  return updateState;
}

function sendUpdateStatus(type, payload) {
  const message = {
    type,
    payload: payload || null,
    state: updateState,
  };
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) win.webContents.send("app-update:status", message);
    } catch (_) {
      // ignore
    }
  }
}

autoUpdater.on("checking-for-update", () => {
  setUpdateState({
    status: "checking",
    checking: true,
    error: null,
  });
  sendUpdateStatus("checking-for-update");
});

autoUpdater.on("update-available", (info) => {
  setUpdateState({
    status: "update-available",
    checking: false,
    updateAvailable: true,
    downloaded: false,
    info: info || null,
    progress: null,
    error: null,
  });
  sendUpdateStatus("update-available", { info: info || null });
});

autoUpdater.on("update-not-available", (info) => {
  setUpdateState({
    status: "update-not-available",
    checking: false,
    updateAvailable: false,
    downloaded: false,
    info: info || null,
    progress: null,
    error: null,
  });
  sendUpdateStatus("update-not-available", { info: info || null });
});

autoUpdater.on("download-progress", (progress) => {
  setUpdateState({
    status: "downloading",
    checking: false,
    progress: progress || null,
    error: null,
  });
  sendUpdateStatus("download-progress", { progress: progress || null });
});

autoUpdater.on("update-downloaded", (info) => {
  setUpdateState({
    status: "update-downloaded",
    checking: false,
    updateAvailable: true,
    downloaded: true,
    info: info || updateState.info,
    error: null,
  });
  sendUpdateStatus("update-downloaded", { info: info || null });
});

autoUpdater.on("error", (err) => {
  const error = serializeUpdateError(err);
  setUpdateState({
    status: "error",
    checking: false,
    error,
  });
  sendUpdateStatus("error", { error });
});

// ---- Instructions local-store helpers ----
function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

const DEFAULT_UI_ZOOM_FACTOR = 0.7;
const MIN_UI_ZOOM_FACTOR = 0.6;
const MAX_UI_ZOOM_FACTOR = 0.9;
const UI_ZOOM_STEP = 0.05;

function normalizeUiZoomFactor(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_UI_ZOOM_FACTOR;
  const rounded = Math.round(num / UI_ZOOM_STEP) * UI_ZOOM_STEP;
  const clamped = Math.min(MAX_UI_ZOOM_FACTOR, Math.max(MIN_UI_ZOOM_FACTOR, rounded));
  return Number(clamped.toFixed(2));
}

function readUiSettings() {
  const raw = readJsonSafe(uiSettingsPath);
  return {
    uiZoomFactor: normalizeUiZoomFactor(raw && raw.uiZoomFactor),
  };
}

function writeUiSettings(next) {
  const raw = next && typeof next === "object" ? next : {};
  const normalized = {
    uiZoomFactor: normalizeUiZoomFactor(raw.uiZoomFactor),
  };
  writeJsonAtomic(uiSettingsPath, normalized);
  return normalized;
}

function getCurrentUiZoomFactor() {
  return readUiSettings().uiZoomFactor;
}

function buildUiZoomState() {
  const zoomFactor = getCurrentUiZoomFactor();
  return {
    ok: true,
    zoomFactor,
    zoomPercent: Math.round(zoomFactor * 100),
    min: MIN_UI_ZOOM_FACTOR,
    max: MAX_UI_ZOOM_FACTOR,
    step: UI_ZOOM_STEP,
  };
}

function applyUiZoomFactor(value) {
  const zoomFactor = normalizeUiZoomFactor(value);
  const settings = writeUiSettings({ uiZoomFactor: zoomFactor });
  if (isLiveWindow(mainWindow)) {
    try {
      mainWindow.webContents.setZoomFactor(settings.uiZoomFactor);
    } catch (_) {
      // ignore
    }
  }
  return settings.uiZoomFactor;
}

function stepUiZoomFactor(direction) {
  const current = getCurrentUiZoomFactor();
  const delta = direction === "in" ? UI_ZOOM_STEP : direction === "out" ? -UI_ZOOM_STEP : 0;
  return applyUiZoomFactor(current + delta);
}

function createInstallId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `install-${Date.now().toString(16)}-${crypto.randomBytes(16).toString("hex")}`;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function getWindowsMachineGuid() {
  if (process.platform !== "win32") return "";
  try {
    const result = spawnSync(
      "reg.exe",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      {
        encoding: "utf8",
        windowsHide: true,
      }
    );
    if (result.status !== 0) return "";
    const stdout = (result.stdout || "").toString();
    const match = stdout.match(/MachineGuid\s+REG_\w+\s+([^\r\n]+)/i);
    return match && match[1] ? match[1].trim() : "";
  } catch (_) {
    return "";
  }
}

function getFallbackDeviceSeed() {
  try {
    if (fs.existsSync(deviceSeedPath)) {
      const existing = fs.readFileSync(deviceSeedPath, "utf8").trim();
      if (existing) return existing;
    }
  } catch (_) {
    // ignore and regenerate once below
  }

  const seed = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(path.dirname(deviceSeedPath), { recursive: true });
    fs.writeFileSync(deviceSeedPath, seed, "utf8");
  } catch (_) {
    // ignore; we can still derive a hash for this process
  }
  return seed;
}

function createDeviceHash() {
  const namespace = "answerdesk-ai-device-v1:";
  const machineGuid = getWindowsMachineGuid();
  const source = machineGuid || getFallbackDeviceSeed();
  return sha256Hex(`${namespace}${source}`);
}

function createDefaultLicenseState() {
  return {
    schemaVersion: 1,
    installId: createInstallId(),
    deviceHash: createDeviceHash(),
    status: "not_registered",
    registeredEmail: null,
    licenseId: null,
    activationId: null,
    licenseKeyLast4: null,
    trialStartedAt: null,
    trialExpiresAt: null,
    licenseActivatedAt: null,
    lastValidatedAt: null,
    serverTime: null,
    offlineGraceExpiresAt: null,
    lastError: null,
    checkoutUrl: null,
    paymentProvider: null,
    statusSignature: null,
    updatedAt: nowIso(),
  };
}

function nullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeLicenseState(state) {
  const raw = state && typeof state === "object" ? state : {};
  const installId = nullableString(raw.installId) || createInstallId();
  const deviceHash = nullableString(raw.deviceHash) || createDeviceHash();
  const updatedAt = nullableString(raw.updatedAt) || nowIso();
  return {
    schemaVersion: 1,
    installId,
    deviceHash,
    status: nullableString(raw.status) || "not_registered",
    registeredEmail: nullableString(raw.registeredEmail),
    licenseId: nullableString(raw.licenseId),
    activationId: nullableString(raw.activationId),
    licenseKeyLast4: nullableString(raw.licenseKeyLast4),
    trialStartedAt: nullableString(raw.trialStartedAt),
    trialExpiresAt: nullableString(raw.trialExpiresAt),
    licenseActivatedAt: nullableString(raw.licenseActivatedAt),
    lastValidatedAt: nullableString(raw.lastValidatedAt),
    serverTime: nullableString(raw.serverTime),
    offlineGraceExpiresAt: nullableString(raw.offlineGraceExpiresAt),
    lastError: nullableString(raw.lastError),
    checkoutUrl: nullableString(raw.checkoutUrl),
    paymentProvider: nullableString(raw.paymentProvider),
    statusSignature: nullableString(raw.statusSignature),
    updatedAt,
  };
}

function ensureLicenseStateFile() {
  const normalized = normalizeLicenseState(readJsonSafe(licenseStatePath));
  writeJsonAtomic(licenseStatePath, normalized);
  return normalized;
}

function readLicenseState() {
  return ensureLicenseStateFile();
}

function writeLicenseStatePatch(patch) {
  const current = readLicenseState();
  const normalizedPatch = patch && typeof patch === "object" ? patch : {};
  const next = normalizeLicenseState({
    ...current,
    ...normalizedPatch,
    installId: current.installId,
  });
  writeJsonAtomic(licenseStatePath, next);
  return next;
}

function licenseApiUrl(pathname) {
  const pathText = String(pathname || "").trim();
  const suffix = pathText.startsWith("/") ? pathText : `/${pathText}`;
  return `${LICENSE_API_BASE_URL}${suffix}`;
}

function getAppVersion() {
  try {
    return app.getVersion();
  } catch (_) {
    return "0.0.0";
  }
}

async function callLicenseApi(pathname, payload) {
  if (typeof fetch !== "function") {
    throw new Error("Licensing API call failed: fetch is unavailable in this Electron runtime.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(licenseApiUrl(pathname), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("Licensing API request timed out.");
    }
    throw new Error(`Licensing API request failed: ${err && err.message ? err.message : err}`);
  } finally {
    clearTimeout(timer);
  }

  let result;
  try {
    result = await response.json();
  } catch (err) {
    throw new Error(`Licensing API returned invalid JSON: ${err && err.message ? err.message : err}`);
  }

  if (!response.ok) {
    const message = nullableString(result && result.message) || `HTTP ${response.status}`;
    throw new Error(`Licensing API request failed: ${message}`);
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Licensing API returned an invalid response.");
  }

  return result;
}

function applyLicenseApiResult(result, fallbackPatch) {
  const source = result && typeof result === "object" ? result : {};
  const patch = {
    ...(fallbackPatch && typeof fallbackPatch === "object" ? fallbackPatch : {}),
    updatedAt: nowIso(),
  };
  const fields = [
    "status",
    "registeredEmail",
    "licenseId",
    "activationId",
    "licenseKeyLast4",
    "trialStartedAt",
    "trialExpiresAt",
    "licenseActivatedAt",
    "lastValidatedAt",
    "serverTime",
    "offlineGraceExpiresAt",
    "checkoutUrl",
    "paymentProvider",
    "statusSignature",
  ];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      patch[field] = nullableString(source[field]);
    }
  }

  patch.lastError = source.ok === false
    ? (nullableString(source.message) || "Licensing API returned an unsuccessful response.")
    : null;

  return writeLicenseStatePatch(patch);
}

const SUPPORT_PACKAGE_VERSION = 1;
const REDACTED_VALUE = "[REDACTED]";
const SECRET_KEY_PATTERN = /(apikey|key|token|secret|connectionstring|connection_string|password|licensekey|machineguid|deviceseed)/i;

function supportTimestampPart(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function supportExportFileName() {
  return `answerdesk-troubleshooting-${supportTimestampPart()}.zip`;
}

function cloneJsonSafe(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function redactSensitiveValue(value) {
  if (Array.isArray(value)) return value.map(() => REDACTED_VALUE);
  if (value && typeof value === "object") return REDACTED_VALUE;
  return REDACTED_VALUE;
}

function redactObjectRecursive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactObjectRecursive(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      result[key] = redactSensitiveValue(entryValue);
    } else {
      result[key] = redactObjectRecursive(entryValue);
    }
  }
  return result;
}

function sanitizeProviderConfig(raw) {
  const source = raw && typeof raw === "object" ? cloneJsonSafe(raw) : {};
  const sanitized = redactObjectRecursive(source);
  const activeProvider = nullableString(source && source.activeProvider);
  const providers = source && source.providers && typeof source.providers === "object" ? source.providers : {};

  for (const [providerId, providerConfig] of Object.entries(providers)) {
    if (!providerConfig || typeof providerConfig !== "object") continue;
    const target = sanitized.providers && sanitized.providers[providerId] && typeof sanitized.providers[providerId] === "object"
      ? sanitized.providers[providerId]
      : null;
    if (!target) continue;

    const apiKeyValue = nullableString(providerConfig.apiKey) || nullableString(providerConfig.key);
    if (Object.prototype.hasOwnProperty.call(target, "apiKey")) delete target.apiKey;
    if (Object.prototype.hasOwnProperty.call(target, "key")) delete target.key;
    target.apiKeyPresent = !!apiKeyValue;
    target.isActiveProvider = activeProvider === providerId;
  }

  return sanitized;
}

function sanitizeLicenseState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  return {
    schemaVersion: state.schemaVersion ?? null,
    installId: nullableString(state.installId),
    deviceHashPresent: !!nullableString(state.deviceHash),
    status: nullableString(state.status),
    registeredEmail: nullableString(state.registeredEmail),
    licenseId: nullableString(state.licenseId),
    activationId: nullableString(state.activationId),
    licenseKeyLast4: nullableString(state.licenseKeyLast4),
    trialStartedAt: nullableString(state.trialStartedAt),
    trialExpiresAt: nullableString(state.trialExpiresAt),
    licenseActivatedAt: nullableString(state.licenseActivatedAt),
    lastValidatedAt: nullableString(state.lastValidatedAt),
    serverTime: nullableString(state.serverTime),
    offlineGraceExpiresAt: nullableString(state.offlineGraceExpiresAt),
    lastError: nullableString(state.lastError),
    checkoutUrl: nullableString(state.checkoutUrl),
    paymentProvider: nullableString(state.paymentProvider),
    updatedAt: nullableString(state.updatedAt),
  };
}

function sanitizeLogText(text) {
  return String(text || "")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/ig, `$1${REDACTED_VALUE}`)
    .replace(/(bearer\s+)[A-Za-z0-9._\-+/=]+/ig, `$1${REDACTED_VALUE}`)
    .replace(/((?:api[_-]?key|token|secret|password|connection[_-]?string|license[_-]?key)\s*[:=]\s*)[^\s,;]+/ig, `$1${REDACTED_VALUE}`)
    .replace(/([?&](?:api[_-]?key|token|secret|password|connection[_-]?string|license[_-]?key)=)[^&\s]+/ig, `$1${REDACTED_VALUE}`);
}

function readRecentLogSection(filePath, title, maxLines = 300) {
  try {
    if (!fs.existsSync(filePath)) {
      return `${title}\n(no log file found)\n`;
    }
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    const tail = lines.slice(Math.max(0, lines.length - maxLines)).map((line) => sanitizeLogText(line));
    return `${title}\n${tail.join("\n").trim()}\n`;
  } catch (err) {
    return `${title}\n(log read failed: ${err && err.message ? err.message : err})\n`;
  }
}

function buildRecentAppLogText() {
  const combined = [
    readRecentLogSection(backendStdoutLogPath, "=== backend.log ==="),
    readRecentLogSection(backendStderrLogPath, "=== backend-error.log ==="),
  ].join("\n").trim();
  return combined || "No backend logs were found.";
}

function getUserDataDirLabel() {
  try {
    return path.basename(userDataDir);
  } catch (_) {
    return "userData";
  }
}

function getLocaleSafe() {
  try {
    return app.getLocale();
  } catch (_) {
    return null;
  }
}

function getTimezoneSafe() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch (_) {
    return null;
  }
}

function buildSystemInfo(exportTime) {
  return {
    exportTime,
    appVersion: getAppVersion(),
    appName: nullableString(app.getName()),
    productName: nullableString(app.name) || nullableString(app.getName()),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osType: os.type(),
    locale: getLocaleSafe(),
    timezone: getTimezoneSafe(),
    electronVersion: process.versions.electron || null,
    chromeVersion: process.versions.chrome || null,
    nodeVersion: process.versions.node || null,
    userDataDir: getUserDataDirLabel(),
  };
}

function buildSupportInfo(exportTime, licenseState, providerConfig, logsIncluded) {
  const activeProvider = nullableString(providerConfig && providerConfig.activeProvider);
  const providerDetails = activeProvider && providerConfig && providerConfig.providers && typeof providerConfig.providers === "object"
    ? providerConfig.providers[activeProvider]
    : null;
  return {
    exportTime,
    appVersion: getAppVersion(),
    isPackaged: app.isPackaged,
    supportPackageVersion: SUPPORT_PACKAGE_VERSION,
    generatedBy: "AnswerDesk AI",
    licenseStatus: nullableString(licenseState && licenseState.status),
    registeredEmail: nullableString(licenseState && licenseState.registeredEmail),
    trialStartedAt: nullableString(licenseState && licenseState.trialStartedAt),
    trialExpiresAt: nullableString(licenseState && licenseState.trialExpiresAt),
    lastValidatedAt: nullableString(licenseState && licenseState.lastValidatedAt),
    activeProvider,
    providerConfigured: !!(providerDetails && typeof providerDetails === "object" && Object.keys(providerDetails).length > 0),
    logsIncluded,
    contentsNote: "No audio, transcripts, API keys, or personal files are included.",
  };
}

function addZipJson(zip, entryName, value) {
  zip.addFile(entryName, Buffer.from(JSON.stringify(value, null, 2), "utf8"));
}

function createTroubleshootingZip() {
  const exportTime = nowIso();
  const rawLicenseState = readJsonSafe(licenseStatePath);
  const rawProviderConfig = readJsonSafe(providerConfigPath);
  const recentAppLogText = buildRecentAppLogText();
  const zip = new AdmZip();

  addZipJson(zip, "support-info.json", buildSupportInfo(exportTime, rawLicenseState, rawProviderConfig, !!recentAppLogText.trim()));
  addZipJson(zip, "system-info.json", buildSystemInfo(exportTime));
  addZipJson(zip, "license-state-redacted.json", sanitizeLicenseState(rawLicenseState));
  addZipJson(zip, "provider-config-redacted.json", sanitizeProviderConfig(rawProviderConfig));
  zip.addFile("recent-app-log.txt", Buffer.from(recentAppLogText, "utf8"));

  return zip;
}

function defaultInstructionsText() {
  return (
    "Speak slowly and clearly.\n" +
    "No greeting.\n" +
    "Be concise and structured.\n" +
    "Answer only what is asked.\n" +
    "Do not ask follow-up questions.\n" +
    "Use a short structure: (1) Direct answer, (2) Key points (max 5), (3) Next steps (max 3)."
  );
}

function resolveBundledJsonPath(basename) {
  const candidates = [
    path.join(__dirname, basename),
    path.join(__dirname, "..", basename),
    path.join(__dirname, "..", "renderer", basename),
    path.join(process.cwd(), basename),
    path.join(process.cwd(), "renderer", basename),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {
      // ignore
    }
  }
  return null;
}

function normalizeInstructionsStore(store) {
  const now = nowIso();
  const raw = store && typeof store === "object" ? store : {};
  const block = raw.realtime && typeof raw.realtime === "object" ? raw.realtime : raw;
  const fallback = defaultInstructionsText();
  const def = String(block.default || fallback).trim() || fallback;
  const cur = String(block.current || def).trim() || def;
  const updatedAt = String(block.updatedAt || raw.updatedAt || now).trim() || now;

  return {
    realtime: {
      default: def,
      current: cur,
      updatedAt,
    },
    updatedAt: String(raw.updatedAt || updatedAt || now).trim() || now,
  };
}

function ensureInstructionsFile() {
  if (!fs.existsSync(instructionsPath) && fs.existsSync(legacyInstructionsPath)) {
    const legacy = readJsonSafe(legacyInstructionsPath);
    if (legacy && typeof legacy === "object") {
      writeJsonAtomic(instructionsPath, normalizeInstructionsStore(legacy));
      return;
    }
  }

  const existing = readJsonSafe(instructionsPath);
  if (existing && typeof existing === "object") {
    const normalized = normalizeInstructionsStore(existing);
    writeJsonAtomic(instructionsPath, normalized);
    return;
  }

  // Seed from bundled instructions.json if present
  const bundled = resolveBundledJsonPath("instructions.json");
  if (bundled) {
    const seeded = readJsonSafe(bundled);
    if (seeded && typeof seeded === "object") {
      const normalized = normalizeInstructionsStore(seeded);
      writeJsonAtomic(instructionsPath, normalized);
      return;
    }
  }

  // Fallback
  const normalized = normalizeInstructionsStore({});
  writeJsonAtomic(instructionsPath, normalized);
}

function ensureTargetInStore(store, target) {
  const t = "realtime";
  if (!store.realtime) {
    const now = nowIso();
    store.realtime = {
      default: defaultInstructionsText(),
      current: defaultInstructionsText(),
      updatedAt: now,
    };
    store.updatedAt = now;
  }
  return t;
}

// ---- IPC handlers (sandbox-safe renderer access) ----
ipcMain.handle("license:get-state", async () => readLicenseState());

ipcMain.handle("license:get-cache-path", async () => licenseStatePath);

ipcMain.handle("license:start-trial", async (_evt, payload) => {
  const email = nullableString(payload && payload.email);
  if (!email || !email.includes("@")) {
    return {
      ok: false,
      message: "A valid email address is required to start a trial.",
      state: readLicenseState(),
    };
  }

  try {
    const current = readLicenseState();
    const result = await callLicenseApi("/v1/license/trial/start", {
      email,
      installId: current.installId,
      deviceHash: current.deviceHash,
      appVersion: getAppVersion(),
      platform: process.platform,
    });
    const state = applyLicenseApiResult(result, { registeredEmail: email });
    const message = nullableString(result.message) || "";
    return { ok: result.ok === true, message, state };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const state = writeLicenseStatePatch({
      lastError: message,
      updatedAt: nowIso(),
    });
    return { ok: false, message, state };
  }
});

ipcMain.handle("license:validate", async () => {
  try {
    const current = readLicenseState();
    const result = await callLicenseApi("/v1/license/validate", {
      installId: current.installId,
      deviceHash: current.deviceHash,
      licenseId: current.licenseId,
      activationId: current.activationId,
      appVersion: getAppVersion(),
    });
    const state = applyLicenseApiResult(result);
    const message = nullableString(result.message) || "";
    return { ok: result.ok === true, message, state };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const state = writeLicenseStatePatch({
      lastError: message,
      updatedAt: nowIso(),
    });
    return { ok: false, message, state };
  }
});

ipcMain.handle("license:activate", async (_evt, payload) => {
  const licenseKey = nullableString(payload && payload.licenseKey);
  if (!licenseKey) {
    return {
      ok: false,
      message: "License key is required.",
      state: readLicenseState(),
    };
  }

  try {
    const current = readLicenseState();
    const email = nullableString(payload && payload.email) || current.registeredEmail;
    const result = await callLicenseApi("/v1/license/activate", {
      email,
      licenseKey,
      installId: current.installId,
      deviceHash: current.deviceHash,
      appVersion: getAppVersion(),
    });
    const state = applyLicenseApiResult(result, email ? { registeredEmail: email } : null);
    const message = nullableString(result.message) || "";
    return { ok: result.ok === true, message, state };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const state = writeLicenseStatePatch({
      lastError: message,
      updatedAt: nowIso(),
    });
    return { ok: false, message, state };
  }
});

ipcMain.handle("license:open-checkout", async () => {
  const state = readLicenseState();
  const checkoutUrl = nullableString(state.checkoutUrl);
  if (!checkoutUrl) {
    return { ok: false, message: "Checkout URL is not configured yet.", state };
  }

  try {
    const url = new URL(checkoutUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, message: "Checkout URL is invalid.", state };
    }
    await shell.openExternal(url.toString());
    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : "Checkout URL could not be opened.",
      state,
    };
  }
});

ipcMain.handle("support:export-troubleshooting-package", async () => {
  try {
    const defaultPath = path.join(app.getPath("documents"), supportExportFileName());
    const saveResult = await dialog.showSaveDialog(isLiveWindow(mainWindow) ? mainWindow : undefined, {
      title: "Export Troubleshooting Package",
      defaultPath,
      filters: [{ name: "ZIP files", extensions: ["zip"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, canceled: true };
    }

    const targetPath = saveResult.filePath.toLowerCase().endsWith(".zip")
      ? saveResult.filePath
      : `${saveResult.filePath}.zip`;
    const zip = createTroubleshootingZip();
    zip.writeZip(targetPath);
    return { ok: true, filePath: targetPath };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : String(err),
    };
  }
});

ipcMain.handle("ui-zoom:get", async () => buildUiZoomState());

ipcMain.handle("ui-zoom:set", async (_evt, value) => {
  applyUiZoomFactor(value);
  return buildUiZoomState();
});

ipcMain.handle("ui-zoom:step", async (_evt, direction) => {
  stepUiZoomFactor(direction);
  return buildUiZoomState();
});

ipcMain.handle("ui-zoom:reset", async () => {
  applyUiZoomFactor(DEFAULT_UI_ZOOM_FACTOR);
  return buildUiZoomState();
});

ipcMain.handle("app-update:get-state", async () => updateState);

ipcMain.handle("app-update:check", async () => {
  setUpdateState({
    status: "checking",
    checking: true,
    progress: null,
    error: null,
  });
  sendUpdateStatus("check-started");

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, state: updateState };
  } catch (err) {
    const error = serializeUpdateError(err);
    setUpdateState({
      status: "error",
      checking: false,
      error,
    });
    sendUpdateStatus("error", { error });
    return { ok: false, error, state: updateState };
  }
});

ipcMain.handle("app-update:download", async () => {
  setUpdateState({
    status: "downloading",
    checking: false,
    error: null,
  });
  sendUpdateStatus("download-started");

  try {
    await autoUpdater.downloadUpdate();
    return { ok: true, state: updateState };
  } catch (err) {
    const error = serializeUpdateError(err);
    setUpdateState({
      status: "error",
      checking: false,
      error,
    });
    sendUpdateStatus("error", { error });
    return { ok: false, error, state: updateState };
  }
});

ipcMain.handle("app-update:quit-and-install", async () => {
  setUpdateState({
    status: "installing",
    error: null,
  });
  sendUpdateStatus("quit-and-install");

  isQuitting = true;
  stopBackend();
  autoUpdater.quitAndInstall(false, true);
  return { ok: true, state: updateState };
});

ipcMain.handle("instructions:read", async () => readJsonSafe(instructionsPath));
ipcMain.handle("instructions:write", async (_evt, payload) =>
  writeJsonAtomic(instructionsPath, payload)
);
ipcMain.handle("instructions:path", async () => instructionsPath);

// ---- Higher-level Instructions API (target-based) ----
// This keeps web-like semantics but persists to local JSON files.
// Renderer should use these to avoid read/modify/write races.
ipcMain.handle("instructions:paths", async () => ({
  instructionsPath,
}));

ipcMain.handle("instructions:get", async (_evt, args) => {
  ensureInstructionsFile();
  const store = normalizeInstructionsStore(readJsonSafe(instructionsPath));
  const target = ensureTargetInStore(store, args && args.target);
  // persist any normalization / new target creation
  writeJsonAtomic(instructionsPath, store);
  const t = store[target];
  return { current: t.current, default: t.default, updatedAt: t.updatedAt };
});

ipcMain.handle("instructions:put", async (_evt, args) => {
  ensureInstructionsFile();
  const store = normalizeInstructionsStore(readJsonSafe(instructionsPath));
  const target = ensureTargetInStore(store, args && args.target);

  const now = nowIso();
  const current = String((args && args.current) || "").trim();
  store[target].current = current || store[target].default || defaultInstructionsText();
  store[target].updatedAt = now;
  store.updatedAt = now;

  writeJsonAtomic(instructionsPath, store);

  const t = store[target];
  return { current: t.current, default: t.default, updatedAt: t.updatedAt };
});

ipcMain.handle("instructions:reset", async (_evt, args) => {
  ensureInstructionsFile();
  const store = normalizeInstructionsStore(readJsonSafe(instructionsPath));
  const target = ensureTargetInStore(store, args && args.target);

  const now = nowIso();
  store[target].current = store[target].default || defaultInstructionsText();
  store[target].updatedAt = now;
  store.updatedAt = now;

  writeJsonAtomic(instructionsPath, store);

  const t = store[target];
  return { current: t.current, default: t.default, updatedAt: t.updatedAt };
});

let mainWindow;
let miniControlWindow = null;

const allowedMiniControlCommands = new Set([
  "start",
  "stop",
  "refresh",
  "repeat",
  "reset",
]);

function isLiveWindow(win) {
  return !!win && !win.isDestroyed();
}

function sendToMainWindow(channel, payload) {
  if (!isLiveWindow(mainWindow)) return false;
  try {
    mainWindow.webContents.send(channel, payload || {});
    return true;
  } catch (_) {
    return false;
  }
}

function sendToMiniControlWindow(channel, payload) {
  if (!isLiveWindow(miniControlWindow)) return false;
  try {
    miniControlWindow.webContents.send(channel, payload || {});
    return true;
  } catch (_) {
    return false;
  }
}

function closeMiniControlWindow() {
  if (!isLiveWindow(miniControlWindow)) {
    miniControlWindow = null;
    return;
  }

  const win = miniControlWindow;
  miniControlWindow = null;

  try {
    win.close();
  } catch (_) {
    // ignore
  }
}

function requestMiniControlStatus() {
  sendToMainWindow("mini-control:request-status", {});
}

function createMiniControlWindow() {
  if (isLiveWindow(miniControlWindow)) {
    try {
      miniControlWindow.show();
      miniControlWindow.focus();
      requestMiniControlStatus();
    } catch (_) {
      // ignore
    }
    return miniControlWindow;
  }

  miniControlWindow = new BrowserWindow({
    width: 100,
    height: 500,
    minWidth: 200,
    minHeight: 460,
    maxWidth: 260,
    maxHeight: 580,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  miniControlWindow.setMenuBarVisibility(false);

  miniControlWindow.once("ready-to-show", () => {
    if (!isLiveWindow(miniControlWindow)) return;
    miniControlWindow.show();
    miniControlWindow.focus();
    requestMiniControlStatus();
  });

  miniControlWindow.webContents.once("did-finish-load", () => {
    requestMiniControlStatus();
  });

  miniControlWindow.on("closed", () => {
    miniControlWindow = null;
  });

  const miniPath = path.join(__dirname, "..", "renderer", "mini-control.html");
  miniControlWindow.loadFile(miniPath);

  return miniControlWindow;
}

function restoreMainWindowFromMiniControl() {
  if (!isLiveWindow(mainWindow)) {
    createWindow();
  }

  if (isLiveWindow(mainWindow)) {
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      requestMiniControlStatus();
    } catch (_) {
      // ignore
    }
  }

  closeMiniControlWindow();
}

ipcMain.handle("mini-control:command", async (_evt, command) => {
  const normalized = String(command || "").trim();
  if (!allowedMiniControlCommands.has(normalized)) {
    return { ok: false, error: `Unsupported mini-control command: ${normalized}` };
  }

  const sent = sendToMainWindow("mini-control:command", { command: normalized });
  return { ok: sent };
});

ipcMain.handle("mini-control:open-main", async () => {
  restoreMainWindowFromMiniControl();
  return { ok: true };
});

ipcMain.handle("mini-control:close", async () => {
  closeMiniControlWindow();
  return { ok: true };
});

ipcMain.handle("mini-control:status", async (_evt, payload) => {
  const sent = sendToMiniControlWindow("mini-control:status", payload || {});
  return { ok: sent };
});

ipcMain.handle("mini-control:request-status", async () => {
  requestMiniControlStatus();
  return { ok: true };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 860,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setZoomFactor(getCurrentUiZoomFactor());
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(getCurrentUiZoomFactor());
  });

  // Optional: load dev URL if explicitly provided
  const startUrl = process.env.CHATT_START_URL || process.env.ELECTRON_START_URL;

  if (startUrl) {
    mainWindow.loadURL(startUrl);
  } else {
    const indexPath = path.join(__dirname, "..", "renderer", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("minimize", () => {
    if (!isQuitting) createMiniControlWindow();
  });

  mainWindow.on("restore", () => {
    closeMiniControlWindow();
  });

  mainWindow.on("show", () => {
    if (!mainWindow.isMinimized()) closeMiniControlWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    closeMiniControlWindow();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureRuntimeDirectories();
  ensureProviderConfigFile();
  ensureInstructionsFile();
  ensureScenarioPresetsFile();
  ensureLicenseStateFile();

  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackend();
});

app.on("will-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

