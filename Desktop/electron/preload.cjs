const { contextBridge, ipcRenderer } = require("electron");

// electron-audio-loopback registers IPC handlers automatically (enable-loopback-audio / disable-loopback-audio)
contextBridge.exposeInMainWorld("electronAPI", {
  enableLoopbackAudio: () => ipcRenderer.invoke("enable-loopback-audio"),
  disableLoopbackAudio: () => ipcRenderer.invoke("disable-loopback-audio"),

  // Backward-compatible local persistence (raw read/write)
  instructionsRead: () => ipcRenderer.invoke("instructions:read"),
  instructionsWrite: (payload) => ipcRenderer.invoke("instructions:write", payload),
  instructionsPath: () => ipcRenderer.invoke("instructions:path"),

  instructionProfilesRead: () => ipcRenderer.invoke("instructionProfiles:read"),
  instructionProfilesWrite: (payload) => ipcRenderer.invoke("instructionProfiles:write", payload),
  instructionProfilesPath: () => ipcRenderer.invoke("instructionProfiles:path"),

  // Preferred API (target-based, web-like semantics)
  instructions: {
    paths: () => ipcRenderer.invoke("instructions:paths"),
    profilesGet: () => ipcRenderer.invoke("instructions:profilesGet"),
    get: (target) => ipcRenderer.invoke("instructions:get", { target }),
    put: (target, current) => ipcRenderer.invoke("instructions:put", { target, current }),
    reset: (target) => ipcRenderer.invoke("instructions:reset", { target }),
  },
});
