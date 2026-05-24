(() => {
  const api = window.electronAPI && window.electronAPI.miniControl;
  const $ = (id) => document.getElementById(id);

  function setMessage(text) {
    const el = $("miniMessage");
    if (el) el.textContent = text || "Ready";
  }

  function normalizeStatusWord(text, prefix) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const lowered = raw.toLowerCase();
    const prefixLowered = `${prefix.toLowerCase()}:`;
    if (lowered.startsWith(prefixLowered)) {
      return raw.slice(prefix.length + 1).trim();
    }
    return raw;
  }

  function setDisabled(id, disabled) {
    const el = $(id);
    if (el) el.disabled = !!disabled;
  }

  function applyStatus(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const session = String(data.session || "off").toLowerCase();
    const activity = String(data.activity || "idle").toLowerCase();

    document.body.dataset.session = session;
    document.body.dataset.activity = activity;

    const sessionEl = $("miniSession");
    const activityEl = $("miniActivity");

    if (sessionEl) {
      sessionEl.textContent = normalizeStatusWord(data.sessionText || "Session: OFF", "Session") || "OFF";
    }

    if (activityEl) {
      activityEl.textContent = normalizeStatusWord(data.activityText || "Activity: Idle", "Activity") || "Idle";
    }

    const buttons = data.buttons || {};
    setDisabled("miniStart", !!buttons.startDisabled);
    setDisabled("miniStop", !!buttons.stopDisabled);
    setDisabled("miniRefresh", !!buttons.refreshDisabled);
    setDisabled("miniRepeat", !!buttons.repeatDisabled);
    setDisabled("miniReset", !!buttons.resetDisabled);
  }

  function sendCommand(command) {
    if (!api || typeof api.sendCommand !== "function") {
      setMessage("Mini control API unavailable");
      return;
    }

    setMessage(`Command: ${command}`);
    api.sendCommand(command)
      .then((result) => {
        if (result && result.ok === false) {
          setMessage(result.error || `Command failed: ${command}`);
        }
      })
      .catch((err) => {
        setMessage(`Command failed: ${err && err.message ? err.message : err}`);
      });
  }

  function bind(id, handler) {
    const el = $(id);
    if (el) el.addEventListener("click", handler);
  }

  bind("miniStart", () => sendCommand("start"));
  bind("miniStop", () => sendCommand("stop"));
  bind("miniRefresh", () => sendCommand("refresh"));
  bind("miniRepeat", () => sendCommand("repeat"));
  bind("miniReset", () => sendCommand("reset"));

  bind("miniOpen", () => {
    if (api && typeof api.openMainWindow === "function") {
      api.openMainWindow().catch(() => {});
    }
  });

  bind("miniClose", () => {
    if (api && typeof api.close === "function") {
      api.close().catch(() => {});
    }
  });

  if (api && typeof api.onStatus === "function") {
    api.onStatus((payload) => {
      applyStatus(payload);
      setMessage("Ready");
    });
  }

  applyStatus({
    session: "off",
    activity: "idle",
    sessionText: "Session: OFF",
    activityText: "Activity: Idle",
  });

  if (api && typeof api.requestStatus === "function") {
    api.requestStatus().catch(() => {});
  }
})();
