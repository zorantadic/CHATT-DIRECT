const { contextBridge, ipcRenderer } = require("electron");

// electron-audio-loopback registers IPC handlers automatically (enable-loopback-audio / disable-loopback-audio)
contextBridge.exposeInMainWorld("electronAPI", {
  enableLoopbackAudio: () => ipcRenderer.invoke("enable-loopback-audio"),
  disableLoopbackAudio: () => ipcRenderer.invoke("disable-loopback-audio"),

  // Backward-compatible local persistence (raw read/write)
  instructionsRead: () => ipcRenderer.invoke("instructions:read"),
  instructionsWrite: (payload) => ipcRenderer.invoke("instructions:write", payload),
  instructionsPath: () => ipcRenderer.invoke("instructions:path"),

  // Preferred API (target-based, web-like semantics)
  instructions: {
    paths: () => ipcRenderer.invoke("instructions:paths"),
    get: (target) => ipcRenderer.invoke("instructions:get", { target }),
    put: (target, current) => ipcRenderer.invoke("instructions:put", { target, current }),
    reset: (target) => ipcRenderer.invoke("instructions:reset", { target }),
  },

  updates: {
    getState: () => ipcRenderer.invoke("app-update:get-state"),
    check: () => ipcRenderer.invoke("app-update:check"),
    download: () => ipcRenderer.invoke("app-update:download"),
    quitAndInstall: () => ipcRenderer.invoke("app-update:quit-and-install"),
    onStatus: (callback) => {
      const listener = (_event, payload) => {
        if (typeof callback === "function") callback(payload);
      };
      ipcRenderer.on("app-update:status", listener);
      return () => ipcRenderer.removeListener("app-update:status", listener);
    },
  },
});
