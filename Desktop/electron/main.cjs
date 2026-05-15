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

try {
  fs.mkdirSync(cacheDir, { recursive: true });
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

const instructionsPath = path.join(userDataDir, "instructions.local.json");
const profilesPath = path.join(userDataDir, "instruction_profiles.local.json");

// ---- Instructions/Profiles local-store helpers ----
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

function ensureProfilesFile() {
  // If local file exists and is readable JSON, keep it.
  const existing = readJsonSafe(profilesPath);
  if (existing && typeof existing === "object") return;

  // Seed from bundled instruction_profiles.json if present
  const bundled = resolveBundledJsonPath("instruction_profiles.json");
  if (bundled) {
    const seeded = readJsonSafe(bundled);
    if (seeded && typeof seeded === "object") {
      writeJsonAtomic(profilesPath, seeded);
      return;
    }
  }

  // Minimal fallback
  writeJsonAtomic(profilesPath, { version: "1.0", styles: [], domains: [] });
}

function normalizeInstructionsStore(store) {
  const now = nowIso();
  const out = store && typeof store === "object" ? store : {};
  if (!out.updatedAt) out.updatedAt = now;

  const ensureTarget = (t) => {
    if (!out[t] || typeof out[t] !== "object") {
      out[t] = {
        default: defaultInstructionsText(),
        current: defaultInstructionsText(),
        updatedAt: now,
      };
      return;
    }
    out[t].default =
      String(out[t].default || defaultInstructionsText()).trim() ||
      defaultInstructionsText();
    out[t].current =
      String(out[t].current || out[t].default || defaultInstructionsText()).trim() ||
      out[t].default;
    out[t].updatedAt = String(out[t].updatedAt || now).trim() || now;
  };

  // Always ensure core targets; others will be created on demand.
  ensureTarget("realtime");
  ensureTarget("tts");

  return out;
}

function ensureInstructionsFile() {
  const existing = readJsonSafe(instructionsPath);
  if (existing && typeof existing === "object") {
    // Normalize schema to ensure it has at least realtime+tts.
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
  const t = String(target || "realtime").trim().toLowerCase() || "realtime";
  if (!store[t]) {
    const now = nowIso();
    store[t] = {
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

ipcMain.handle("instructionProfiles:read", async () =>
  readJsonSafe(profilesPath)
);
ipcMain.handle("instructionProfiles:write", async (_evt, payload) =>
  writeJsonAtomic(profilesPath, payload)
);
ipcMain.handle("instructionProfiles:path", async () => profilesPath);

// ---- Higher-level Instructions API (target-based) ----
// This keeps web-like semantics but persists to local JSON files.
// Renderer should use these to avoid read/modify/write races.
ipcMain.handle("instructions:paths", async () => ({
  instructionsPath,
  profilesPath,
}));

ipcMain.handle("instructions:profilesGet", async () => {
  ensureProfilesFile();
  return readJsonSafe(profilesPath) || { version: "1.0", styles: [], domains: [] };
});

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
    width: 1300,
    height: 900,
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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
