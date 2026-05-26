import React from "react";
import GlassPanel from "./GlassPanel.jsx";

export default function BottomStatusBar({ connectionState, runtimeState }) {
  const backendState = connectionState.error
    ? `Configured: ${connectionState.backendLabel}`
    : connectionState.loading
      ? `Configured: ${connectionState.backendLabel}`
      : `Connected: ${connectionState.backendLabel}`;

  return (
    <GlassPanel as="footer" className="appBottomBar" aria-label="Runtime status">
      <div className="bottomItem">
        <span className="bottomDot" aria-hidden="true" />
        <span>
          <span className="bottomLabel">Backend</span>
          <span className="bottomValue">{backendState}</span>
        </span>
      </div>
      <div className="bottomItem">
        <span className="bottomDot muted" aria-hidden="true" />
        <span>
          <span className="bottomLabel">WS</span>
          <span className="bottomValue" title={connectionState.realtimeWs}>
            {runtimeState.wsStatus}
          </span>
        </span>
      </div>
      <div className="bottomItem">
        <span>
          <span className="bottomLabel">Audio Input</span>
          <span className="bottomValue">{runtimeState.audioInputStatus}</span>
        </span>
      </div>
      <div className="bottomItem">
        <span>
          <span className="bottomLabel">Output</span>
          <span className="bottomValue">{runtimeState.outputStatus}</span>
        </span>
      </div>
    </GlassPanel>
  );
}
