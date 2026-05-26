import React from "react";
import DataNotice from "../components/DataNotice.jsx";
import GlassPanel from "../components/GlassPanel.jsx";
import ReadonlyField from "../components/ReadonlyField.jsx";
import StatusPill from "../components/StatusPill.jsx";

function firstProvided(values, fallback) {
  return values.find((value) => value && value !== "Not provided" && value !== "Not loaded") || fallback;
}

export default function VoicePage({ connectionState, error, loading, providerState, scenarioState }) {
  const selectedScenario = scenarioState.selected;
  const scenarioName = selectedScenario?.name || "Not loaded";
  const scenarioDescription = selectedScenario
    ? firstProvided(
        [selectedScenario.shortDescription, selectedScenario.recommendedUse, selectedScenario.displayDetails],
        "Scenario behavior is loaded from the Scenarios tab.",
      )
    : "Scenario behavior is loaded from the Scenarios tab.";

  return (
    <div className="voiceDashboard">
      <GlassPanel className="voiceMainCard" aria-label="Voice session">
        <div className="panelHeader">
          <div className="panelIcon" aria-hidden="true" />
          <div>
            <h2>Voice Session</h2>
            <div className="panelSub">Control your realtime voice session</div>
          </div>
        </div>

        <div className="scenarioSummary">
          <div className="scenarioLabel">Selected Scenario</div>
          <div className="scenarioName">{scenarioName}</div>
          <div className="scenarioDescription">{scenarioDescription}</div>
        </div>

        <div className="statusPillRow">
          <StatusPill tone="bad">Session: OFF</StatusPill>
          <StatusPill tone="warn">Activity: Idle</StatusPill>
        </div>

        <DataNotice error={error} loading={loading} />

        <div className="costGuardNotice active" role="status" aria-live="polite">
          Session cost guard is ready. Browser runtime controls are read-only in this phase.
        </div>

        <div className="aiVisual" aria-hidden="true">
          <div className="waveform" />
          <div className="aiCore" />
        </div>

        <div className="voiceControls">
          <div className="controlRow">
            <label htmlFor="realtimeRateVoice">Realtime rate</label>
            <select id="realtimeRateVoice" className="rateSelect" defaultValue="1" disabled>
              <option value="1">1.0</option>
              <option value="0.9">0.9</option>
              <option value="0.8">0.8</option>
            </select>
            <span className="controlHint">Applies to the next connection.</span>
          </div>

          <div className="controlRow">
            <label htmlFor="playbackVolume">Realtime volume</label>
            <input id="playbackVolume" type="range" min="0" max="2" step="0.05" defaultValue="1" disabled />
            <span className="mono volumeValue">1.00</span>
          </div>

          <div className="controlRow">
            <label htmlFor="rtDevice">Output device</label>
            <div className="outputControl">
              <select id="rtDevice" defaultValue="" disabled>
                <option value="">Browser default</option>
              </select>
              <button type="button" disabled>
                Refresh
              </button>
            </div>
            <span className="controlHint">Realtime playback output.</span>
          </div>
        </div>

        <div className="quickControls">
          <div className="quickControlsHeader">Quick controls</div>
          <div className="quickControlsGrid">
            <button className="primaryAction" type="button" disabled>
              Start Direct Realtime
            </button>
            <button className="dangerAction" type="button" disabled>
              Stop
            </button>
            <button type="button" disabled>
              Refresh Instructions
            </button>
            <button type="button" disabled>
              Repeat Last Answer
            </button>
            <button type="button" disabled>
              Reset Session
            </button>
          </div>
        </div>
      </GlassPanel>

      <aside className="voiceSide">
        <GlassPanel className="sideCard" aria-label="Realtime status">
          <div className="panelHeader">
            <div className="panelIcon" aria-hidden="true" />
            <div>
              <h3>Realtime Status</h3>
              <div className="panelSub">Live connection and session information</div>
            </div>
          </div>
          <div className="statusTable">
            <ReadonlyField label="Session" value="OFF" />
            <ReadonlyField label="Activity" value="Idle" />
            <ReadonlyField label="Provider" value={providerState.displayName} />
            <ReadonlyField label="Model" value={providerState.model} />
            <ReadonlyField label="Voice" value={providerState.voice} />
            <ReadonlyField label="Output Language" value={providerState.outgoingLanguage} />
            <ReadonlyField label="Sample Rate" value="24 kHz" />
            <ReadonlyField label="Channels" value="1 mono" />
            <ReadonlyField label="Backend" value={connectionState.backendLabel} />
          </div>
        </GlassPanel>

        <GlassPanel className="sideCard activityCard" aria-label="Activity">
          <div className="panelHeader">
            <div className="panelIcon" aria-hidden="true" />
            <div>
              <h3>Activity</h3>
              <div className="panelSub">Current session activity</div>
            </div>
          </div>
          <div className="activityList">
            <div className="activityItem">Ready. No session activity yet.</div>
            <div className="activityItem">Direct Realtime is disabled in the web parity phase.</div>
          </div>
        </GlassPanel>
      </aside>
    </div>
  );
}
