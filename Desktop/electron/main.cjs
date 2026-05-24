const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
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
const backendInstallDir = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.join(__dirname, "..", "..", "backend");
const providerCapabilitiesPath = path.join(backendInstallDir, "provider_capabilities.json");
const providerConfigExamplePath = path.join(backendInstallDir, "provider_config.local.example.json");
const scenarioPresetsDefaultPath = path.join(backendInstallDir, "scenario_presets.json");
const backendPort = 50505;
const backendStdoutLogPath = path.join(logsDir, "backend.log");
const backendStderrLogPath = path.join(logsDir, "backend-error.log");

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

const APP_UI_ZOOM_FACTOR = 0.7;

let mainWindow;

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

  mainWindow.webContents.setZoomFactor(APP_UI_ZOOM_FACTOR);
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(APP_UI_ZOOM_FACTOR);
  });

  // Optional: load dev URL if explicitly provided
  const startUrl = process.env.CHATT_START_URL || process.env.ELECTRON_START_URL;

  if (startUrl) {
    mainWindow.loadURL(startUrl);
  } else {
    const indexPath = path.join(__dirname, "..", "renderer", "index.html");
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureRuntimeDirectories();
  ensureProviderConfigFile();
  ensureInstructionsFile();
  ensureScenarioPresetsFile();

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

