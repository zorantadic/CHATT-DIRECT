import React from "react";
import DataNotice from "../components/DataNotice.jsx";
import GlassPanel from "../components/GlassPanel.jsx";
import ReadonlyField from "../components/ReadonlyField.jsx";

export default function SettingsPage({ connectionState, error, loading, providerState }) {
  return (
    <div className="settingsDashboard">
      <div className="settingsColumn">
        <GlassPanel className="settingsCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconLink" aria-hidden="true" />
            <div>
              <h3>Connection</h3>
              <div className="panelSub">Configure and manage backend connectivity</div>
            </div>
            <span className={`settingsBadge ${error ? "bad" : "warn"}`}>{error ? "Warning" : "Ready"}</span>
          </div>
          <DataNotice error={error} loading={loading} />
          <div className="statusTable settingsStatusTable">
            <ReadonlyField label="Realtime HTTP" value={connectionState.realtimeHttp} />
            <ReadonlyField label="Realtime WS" value={connectionState.realtimeWs} />
            <ReadonlyField label="Display Language" value="English" hint="Read-only browser placeholder." />
          </div>
          <div className="settingsActions">
            <button type="button" disabled>
              Use Local Backend
            </button>
            <button type="button" disabled>
              Save Settings
            </button>
            <button className="dangerAction" type="button" disabled>
              Reset Settings
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="settingsCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconAudio" aria-hidden="true" />
            <div>
              <h3>Audio Output</h3>
              <div className="panelSub">Configure realtime audio playback</div>
            </div>
            <span className="settingsBadge warn">Not selected</span>
          </div>

          <div className="settingsGrid">
            <label htmlFor="realtimeRate">Realtime Rate</label>
            <select id="realtimeRate" defaultValue="1" disabled>
              <option value="1">1.0</option>
              <option value="0.9">0.9</option>
              <option value="0.8">0.8</option>
            </select>

            <span className="settingsLabel">Playback Volume</span>
            <div className="settingsReadonly">
              <span className="mono">1.00</span>
              <span className="settingsMuted">Live control is on the Voice page.</span>
            </div>

            <span className="settingsLabel">Output Device</span>
            <div className="settingsReadonly">
              <span>Browser default / Not selected</span>
              <span className="settingsMuted">Device selection is not started in the browser runtime.</span>
            </div>
          </div>

          <div className="audioSafetyBox">
            <div className="audioSafetyHeader">
              <div className="audioSafetyTitle">Audio Safety</div>
              <span className="audioSafetyStatus">Status: Not confirmed</span>
            </div>
            <div className="audioSafetyMessage warn">
              Output safety confirmation is read-only. No browser audio route is started.
            </div>
            <div className="audioSafetyActions">
              <button type="button" disabled>
                Test Selected Output
              </button>
              <button type="button" disabled>
                Confirm This Output Uses Headphones
              </button>
              <button type="button" disabled>
                Reset Confirmation
              </button>
            </div>
          </div>

          <div className="audioRouteVisual" aria-hidden="true">
            <div className="routeHeadphones" />
            <div className="routeLine" />
            <div className="routeTarget" />
          </div>
        </GlassPanel>

        <GlassPanel className="settingsCard costGuardCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconShield" aria-hidden="true" />
            <div>
              <h3>Session Cost Guard</h3>
              <div className="panelSub">Protect against unexpected session costs</div>
            </div>
            <span className="settingsBadge warn">Ready</span>
          </div>

          <div className="settingsGrid">
            <label htmlFor="idleGuardMinutes">Auto-stop if idle</label>
            <select id="idleGuardMinutes" defaultValue="0" disabled>
              <option value="0">Off</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
            </select>

            <label htmlFor="idleGuardWarn">Warn before auto-stop</label>
            <label className="switchControl" htmlFor="idleGuardWarn">
              <input id="idleGuardWarn" type="checkbox" defaultChecked disabled />
              <span />
            </label>

            <label htmlFor="maxSessionMinutes">Hard max session duration</label>
            <select id="maxSessionMinutes" defaultValue="0" disabled>
              <option value="0">Off</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          <div className="settingsInfoLine">
            Guard settings are displayed as Desktop parity placeholders. No realtime session is started here.
          </div>
        </GlassPanel>
      </div>

      <div className="settingsColumn">
        <GlassPanel className="settingsCard providerSettingsCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconProvider" aria-hidden="true" />
            <div>
              <h3>Provider Configuration</h3>
              <div className="panelSub">Read-only realtime provider settings</div>
            </div>
            <span className="settingsBadge warn">Not tested</span>
          </div>

          <div className="statusTable settingsStatusTable">
            <ReadonlyField label="Active Provider" value={providerState.displayName} />
            <ReadonlyField label="Region" value={providerState.region} />
            <ReadonlyField label="Endpoint" value={providerState.endpoint} />
            <ReadonlyField label="API Version" value={providerState.apiVersion} />
            <ReadonlyField label={providerState.modelLabel} value={providerState.model} />
            <ReadonlyField label="Voice" value={providerState.voice} />
            <ReadonlyField label="Incoming Language" value={providerState.incomingLanguage} />
            <ReadonlyField label="Outgoing Language" value={providerState.outgoingLanguage} />
            <ReadonlyField label="API Key" value="Stored outside the web UI" />
          </div>

          <div className="settingsActions providerActions">
            <button type="button" disabled>
              Test Connection
            </button>
            <button className="primaryAction" type="button" disabled>
              Save Provider
            </button>
            <button className="dangerAction" type="button" disabled>
              Reset Provider
            </button>
          </div>
          <div className="settingsStatusText">Provider save and test are not implemented in the web parity phase.</div>
        </GlassPanel>

        <GlassPanel className="settingsCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconLink" aria-hidden="true" />
            <div>
              <h3>Application Update</h3>
              <div className="panelSub">Check for and install AnswerDesk AI updates</div>
            </div>
            <span className="settingsBadge warn">Ready</span>
          </div>
          <div className="statusTable settingsStatusTable">
            <ReadonlyField label="Status" value="Ready. No action taken." />
            <ReadonlyField label="Version" value="Unknown version" />
            <ReadonlyField label="Progress" value="No progress yet" />
          </div>
          <div className="settingsActions">
            <button type="button" disabled>
              Check for Updates
            </button>
            <button className="primaryAction" type="button" disabled>
              Download Update
            </button>
            <button type="button" disabled>
              Restart and Install
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="settingsCard diagnosticsCard">
          <div className="settingsCardHeader">
            <div className="settingsIcon settingsIconDiag" aria-hidden="true" />
            <div>
              <h3>Diagnostics</h3>
              <div className="panelSub">System health and connectivity overview</div>
            </div>
          </div>

          <div className="diagnosticsLayout">
            <div className="statusTable settingsStatusTable">
              <ReadonlyField label="Backend" value={error ? "Configured" : "Configured"} />
              <ReadonlyField label="WebSocket" value="Not connected" />
              <ReadonlyField label="Output Route" value="Browser default / Not selected" />
              <ReadonlyField label="Last Provider Test" value="Not tested" />
            </div>
            <div className="diagnosticSeal" aria-hidden="true" />
          </div>

          <div className="settingsInfoLine">
            Web UI parity is read-only: no audio capture, microphone input, or WebSocket runtime is started.
          </div>

          <div className="settingsLogPanel">
            <div className="settingsCardHeader compact">
              <div>
                <h3>Log</h3>
                <div className="panelSub">Current browser UI activity</div>
              </div>
            </div>
            <div className="logbar">
              <input type="text" placeholder="Filter log (contains)..." disabled />
              <label className="check">
                <input type="checkbox" defaultChecked disabled />
                <span>Auto-scroll</span>
              </label>
              <div className="spacer" />
              <button type="button" disabled>
                Copy
              </button>
              <button type="button" disabled>
                Clear
              </button>
              <button type="button" disabled>
                Download
              </button>
            </div>
            <pre id="log">Ready. Diagnostics are read-only in the web UI.</pre>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
