const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { initMain } = require("electron-audio-loopback");

// Must be called before app is ready
initMain();

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
  ensureRuntimeDirectories();
  ensureProviderConfigFile();
  ensureInstructionsFile();
  ensureScenarioPresetsFile();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
