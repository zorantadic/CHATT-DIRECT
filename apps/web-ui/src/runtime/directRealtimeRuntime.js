const INITIAL_RUNTIME_LOG_MESSAGE =
  "Web Direct Realtime capture phase ready. Runtime connection and assistant playback are not implemented yet.";

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

export function startRuntimeStub(captureSummary) {
  const captured = captureSummary?.status === "captured" && captureSummary.audioTrackCount > 0;

  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: captured ? "Browser/system audio captured" : "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message: captured
      ? `${captureSummary.message} Realtime session remains OFF.`
      : `Start Direct Realtime requested, but capture is not active. ${captureSummary?.message || ""}`.trim(),
  };
}

export function stopRuntimeStub(captureSummary) {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message: captureSummary?.message || "Stop requested. Runtime state reset to OFF / Idle.",
  };
}

export function refreshInstructionsStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
    },
    message: "Refresh Instructions requested. Capture phase does not send runtime instruction messages.",
  };
}

export function repeatLastAnswerStub() {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
    },
    message: "Repeat Last Answer requested. Capture phase does not request assistant audio.",
  };
}

export function resetSessionStub(captureSummary) {
  return {
    statePatch: {
      sessionStatus: "OFF",
      activityStatus: "Idle",
      wsStatus: "Not connected",
      audioInputStatus: "Not started",
      outputStatus: "Browser default / Not selected",
    },
    message: captureSummary?.status === "stopped"
      ? `${captureSummary.message} Runtime skeleton state reset; no session exists yet.`
      : "Reset Session requested. Runtime skeleton state reset; no session exists yet.",
  };
}

export function stopAudioNowStub() {
  return {
    statePatch: {
      activityStatus: "Idle",
      outputStatus: "Browser default / Not selected",
    },
    message: "Stop Audio Now requested. No browser assistant audio exists in this capture phase.",
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
