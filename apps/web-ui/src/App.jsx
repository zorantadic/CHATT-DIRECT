import { useMemo, useState } from "react";

const pages = ["Voice", "Settings", "Scenarios"];

function VoicePage({ realtimeHttp, realtimeWs }) {
  return (
    <section className="dashboardGrid" aria-label="Voice">
      <div className="glassPanel heroPanel">
        <div className="eyebrow">Direct Realtime</div>
        <h2>Voice</h2>
        <p>
          Placeholder for the future browser-safe Direct Realtime voice workflow.
          Audio capture and WebSocket streaming are intentionally not implemented yet.
        </p>
        <div className="statusGrid">
          <div>
            <span>Session</span>
            <strong>OFF</strong>
          </div>
          <div>
            <span>Activity</span>
            <strong>Idle</strong>
          </div>
        </div>
      </div>

      <aside className="glassPanel sidePanel">
        <h3>Runtime Endpoints</h3>
        <dl>
          <div>
            <dt>HTTP</dt>
            <dd>{realtimeHttp}</dd>
          </div>
          <div>
            <dt>WebSocket</dt>
            <dd>{realtimeWs}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

function SettingsPage({ realtimeHttp, realtimeWs }) {
  return (
    <section className="settingsGrid" aria-label="Settings">
      <div className="glassPanel">
        <div className="eyebrow">Configuration</div>
        <h2>Settings</h2>
        <div className="readonlyRows">
          <div>
            <span>Realtime HTTP</span>
            <strong>{realtimeHttp}</strong>
          </div>
          <div>
            <span>Realtime WS</span>
            <strong>{realtimeWs}</strong>
          </div>
        </div>
      </div>
      <div className="glassPanel">
        <div className="eyebrow">Audio</div>
        <h2>Output Safety</h2>
        <p>
          Placeholder for web-compatible output-device safety controls. No microphone,
          capture, or live audio routing is enabled in this skeleton.
        </p>
      </div>
    </section>
  );
}

function ScenariosPage() {
  return (
    <section className="glassPanel" aria-label="Scenarios">
      <div className="eyebrow">Behavior</div>
      <h2>Scenarios</h2>
      <p>
        Placeholder for scenario selection and instruction preview. The existing
        backend scenario model is not called from this skeleton yet.
      </p>
      <div className="scenarioCards">
        {["Direct Answer", "Meeting Advisor", "Interview Answer Mode"].map((name) => (
          <article className="scenarioCard" key={name}>
            <span>{name}</span>
            <small>Placeholder</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("Voice");
  const config = useMemo(
    () => ({
      realtimeHttp: import.meta.env.VITE_REALTIME_HTTP || "http://127.0.0.1:50505",
      realtimeWs: import.meta.env.VITE_REALTIME_WS || "ws://127.0.0.1:50505/voice/ws",
    }),
    []
  );

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <div className="eyebrow">CHATT Direct</div>
          <h1>Web Console</h1>
          <p>Parallel web UI skeleton for the Direct Realtime application.</p>
        </div>
        <nav className="tabs" aria-label="Primary">
          {pages.map((page) => (
            <button
              className={activePage === page ? "active" : ""}
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
            >
              {page}
            </button>
          ))}
        </nav>
      </header>

      {activePage === "Voice" && (
        <VoicePage realtimeHttp={config.realtimeHttp} realtimeWs={config.realtimeWs} />
      )}
      {activePage === "Settings" && (
        <SettingsPage realtimeHttp={config.realtimeHttp} realtimeWs={config.realtimeWs} />
      )}
      {activePage === "Scenarios" && <ScenariosPage />}
    </main>
  );
}
