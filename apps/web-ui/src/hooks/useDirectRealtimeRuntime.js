import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCaptureSummary,
  startBrowserDisplayAudioCapture,
  stopBrowserDisplayAudioCapture,
} from "../runtime/browserAudioCapture.js";
import {
  appendRuntimeLog,
  createInitialRuntimeState,
  refreshInstructionsStub,
  repeatLastAnswerStub,
  resetSessionStub,
  startRuntimeStub,
  stopAudioNowStub,
  stopRuntimeStub,
} from "../runtime/directRealtimeRuntime.js";

export default function useDirectRealtimeRuntime() {
  const [runtimeState, setRuntimeState] = useState(createInitialRuntimeState);
  const captureStateRef = useRef(null);

  useEffect(() => {
    return () => {
      stopBrowserDisplayAudioCapture(captureStateRef.current);
      captureStateRef.current = null;
    };
  }, []);

  const runRuntimeCommand = useCallback((command) => {
    setRuntimeState((current) => appendRuntimeLog(current, command()));
  }, []);

  const start = useCallback(async () => {
    if (captureStateRef.current?.status === "captured") {
      setRuntimeState((current) => appendRuntimeLog(current, startRuntimeStub(getCaptureSummary(captureStateRef.current))));
      return;
    }

    const captureState = await startBrowserDisplayAudioCapture();
    captureStateRef.current = captureState.status === "captured" ? captureState : null;

    setRuntimeState((current) => appendRuntimeLog(current, startRuntimeStub(getCaptureSummary(captureState))));
  }, []);

  const stop = useCallback(() => {
    const stopSummary = stopBrowserDisplayAudioCapture(captureStateRef.current);
    captureStateRef.current = null;

    setRuntimeState((current) => appendRuntimeLog(current, stopRuntimeStub(stopSummary)));
  }, []);

  const resetSession = useCallback(() => {
    const stopSummary = stopBrowserDisplayAudioCapture(captureStateRef.current);
    captureStateRef.current = null;

    setRuntimeState((current) => appendRuntimeLog(current, resetSessionStub(stopSummary)));
  }, []);

  const runtimeActions = useMemo(
    () => ({
      start,
      stop,
      refreshInstructions: () => runRuntimeCommand(refreshInstructionsStub),
      repeatLastAnswer: () => runRuntimeCommand(repeatLastAnswerStub),
      resetSession,
      stopAudioNow: () => runRuntimeCommand(stopAudioNowStub),
    }),
    [resetSession, runRuntimeCommand, start, stop],
  );

  return { runtimeActions, runtimeState };
}
