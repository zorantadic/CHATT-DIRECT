import { useCallback, useMemo, useState } from "react";
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

  const runRuntimeCommand = useCallback((command) => {
    setRuntimeState((current) => appendRuntimeLog(current, command()));
  }, []);

  const runtimeActions = useMemo(
    () => ({
      start: () => runRuntimeCommand(startRuntimeStub),
      stop: () => runRuntimeCommand(stopRuntimeStub),
      refreshInstructions: () => runRuntimeCommand(refreshInstructionsStub),
      repeatLastAnswer: () => runRuntimeCommand(repeatLastAnswerStub),
      resetSession: () => runRuntimeCommand(resetSessionStub),
      stopAudioNow: () => runRuntimeCommand(stopAudioNowStub),
    }),
    [runRuntimeCommand],
  );

  return { runtimeActions, runtimeState };
}
