import React from "react";
import GlassPanel from "./GlassPanel.jsx";

export default function BottomStatusBar({ connectionState }) {
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
            Not connected
          </span>
        </span>
      </div>
      <div className="bottomItem">
        <span>
          <span className="bottomLabel">Audio Input</span>
          <span className="bottomValue">Not started</span>
        </span>
      </div>
      <div className="bottomItem">
        <span>
          <span className="bottomLabel">Output</span>
          <span className="bottomValue">Browser default / Not selected</span>
        </span>
      </div>
    </GlassPanel>
  );
}
