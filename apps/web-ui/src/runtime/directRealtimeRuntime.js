const INITIAL_RUNTIME_LOG_MESSAGE =
  "Web Direct Realtime runtime skeleton ready. Audio and realtime transport are not implemented in Phase 5A.";

function createLogMessage(message) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    message,
  };
}

export function createInitialRuntimeState() {
  return {
    sessionStatus: "OFF",
    activityStatus: "Idle",
    wsStatus: "Not connected",
    audioInputStatus: "Not started",
    outputStatus: "Browser default / Not selected",
    lastRuntimeMessage: INITIAL_RUNTIME_LOG_MESSAGE,
    runtimeLog: [createLogMessage(INITIAL_RUNTIME_LOG_MESSAGE)],
  };
}

export function startRuntimeStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message:
      "Start Direct Realtime requested. Phase 5A only records the command; no live session was started.",
  };
}

export function stopRuntimeStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message: "Stop requested. Runtime state reset to OFF / Idle.",
  };
}

export function refreshInstructionsStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
    },
    message: "Refresh Instructions requested. Phase 5A does not send runtime instruction messages.",
  };
}

export function repeatLastAnswerStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
    },
    message: "Repeat Last Answer requested. Phase 5A does not request assistant audio.",
  };
}

export function resetSessionStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message: "Reset Session requested. Runtime skeleton state reset; no session exists yet.",
  };
}

export function stopAudioNowStub() {
  return {
    statePatch: {
      activityStatus: "Idle",
      outputStatus: "Browser default / Not selected",
    },
    message: "Stop Audio Now requested. No browser assistant audio exists in Phase 5A.",
  };
}

export function appendRuntimeLog(state, result) {
  const message = result?.message || "Runtime command recorded.";
  return {
    ...state,
    ...(result?.statePatch || {}),
    lastRuntimeMessage: message,
    runtimeLog: [createLogMessage(message), ...(state.runtimeLog || [])].slice(0, 20),
  };
}
