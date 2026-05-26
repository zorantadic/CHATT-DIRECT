import { useEffect, useState } from "react";
import { getProviderCapabilities, getProviderConfig } from "./api/providerClient.js";
import { getScenarios } from "./api/scenarioClient.js";
import runtimeConfig from "./config/runtimeConfig.js";

const pages = ["Voice", "Settings", "Scenarios"];

function textValue(value, fallback = "Not loaded") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function providerDisplayName(providerId, providerCapabilities) {
  const caps = providerCapabilities?.providers?.[providerId];
  return textValue(caps?.displayName || caps?.label || caps?.name || providerId);
}

function selectedProviderConfig(providerConfig) {
  const activeProvider = textValue(providerConfig?.activeProvider, "");
  return activeProvider ? providerConfig?.providers?.[activeProvider] || {} : {};
}

function activeScenario(scenarioData) {
  const scenarios = Array.isArray(scenarioData?.scenarios) ? scenarioData.scenarios : [];
  const id = textValue(scenarioData?.activeScenarioId || scenarioData?.defaultScenarioId, "");
  return scenarios.find((scenario) => String(scenario?.id || "") === id) || null;
}

function DataNotice({ loading, error }) {
  if (loading) return <div className="dataNotice">Loading backend data...</div>;
  if (error) return <div className="dataNotice error">{error}</div>;
  return null;
}

function VoicePage({ realtimeHttp, realtimeWs, scenarioData, loading, error }) {
  const scenario = activeScenario(scenarioData);

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
        <div className="summaryPanel">
          <span>Selected Scenario</span>
          <strong>{textValue(scenario?.name || scenario?.id)}</strong>
          <p>{textValue(scenario?.displayDetails || scenario?.shortDescription, "Scenario data is not loaded.")}</p>
        </div>
      </div>

      <aside className="glassPanel sidePanel">
        <h3>Runtime Endpoints</h3>
        <DataNotice loading={loading} error={error} />
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

function SettingsPage({ realtimeHttp, realtimeWs, providerConfig, providerCapabilities, loading, error }) {
  const activeProvider = textValue(providerConfig?.activeProvider, "");
  const activeConfig = selectedProviderConfig(providerConfig);

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
        <div className="eyebrow">Provider</div>
        <h2>Provider Summary</h2>
        <DataNotice loading={loading} error={error} />
        <div className="readonlyRows">
          <div>
            <span>Active Provider</span>
            <strong>{providerDisplayName(activeProvider, providerCapabilities)}</strong>
          </div>
          <div>
            <span>Model</span>
            <strong>{textValue(activeConfig.model)}</strong>
          </div>
          <div>
            <span>Voice</span>
            <strong>{textValue(activeConfig.voice)}</strong>
          </div>
          <div>
            <span>Incoming Language</span>
            <strong>{textValue(activeConfig.incomingLanguage)}</strong>
          </div>
          <div>
            <span>Outgoing Language</span>
            <strong>{textValue(activeConfig.outgoingLanguage)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScenariosPage({ scenarioData, loading, error }) {
  const scenarios = Array.isArray(scenarioData?.scenarios) ? scenarioData.scenarios : [];
  const selected = activeScenario(scenarioData);
  const selectedId = textValue(selected?.id, "");

  return (
    <section className="glassPanel" aria-label="Scenarios">
      <div className="eyebrow">Behavior</div>
      <h2>Scenarios</h2>
      <p>
        Read-only scenario list loaded from the existing Direct Realtime backend.
        Scenario save, edit, and delete actions are intentionally not implemented here.
      </p>
      <DataNotice loading={loading} error={error} />
      <div className="scenarioCards">
        {scenarios.length === 0 && (
          <article className="scenarioCard">
            <span>No scenarios loaded</span>
            <small>Start the backend to load scenario metadata.</small>
          </article>
        )}
        {scenarios.map((scenario) => (
          <article
            className={scenario?.id === selectedId ? "scenarioCard active" : "scenarioCard"}
            key={scenario?.id || scenario?.name}
          >
            <span>{textValue(scenario?.name || scenario?.id)}</span>
            <small>{scenario?.id === selectedId ? "Selected / Active" : textValue(scenario?.category, "Available")}</small>
            <p>{textValue(scenario?.displayDetails || scenario?.shortDescription, "No description provided.")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("Voice");
  const [backendData, setBackendData] = useState({
    loading: true,
    error: "",
    providerConfig: null,
    providerCapabilities: null,
    scenarioData: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadBackendData() {
      const [providerConfig, providerCapabilities, scenarioData] = await Promise.allSettled([
        getProviderConfig(),
        getProviderCapabilities(),
        getScenarios(),
      ]);
      if (!mounted) return;

      const errors = [providerConfig, providerCapabilities, scenarioData]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message || String(result.reason));

      setBackendData({
        loading: false,
        error: errors.join(" | "),
        providerConfig: providerConfig.status === "fulfilled" ? providerConfig.value : null,
        providerCapabilities: providerCapabilities.status === "fulfilled" ? providerCapabilities.value : null,
        scenarioData: scenarioData.status === "fulfilled" ? scenarioData.value : null,
      });
    }

    loadBackendData().catch((error) => {
      if (!mounted) return;
      setBackendData((current) => ({
        ...current,
        loading: false,
        error: error?.message || String(error),
      }));
    });

    return () => {
      mounted = false;
    };
  }, []);

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
        <VoicePage
          realtimeHttp={runtimeConfig.realtimeHttp}
          realtimeWs={runtimeConfig.realtimeWs}
          scenarioData={backendData.scenarioData}
          loading={backendData.loading}
          error={backendData.error}
        />
      )}
      {activePage === "Settings" && (
        <SettingsPage
          realtimeHttp={runtimeConfig.realtimeHttp}
          realtimeWs={runtimeConfig.realtimeWs}
          providerConfig={backendData.providerConfig}
          providerCapabilities={backendData.providerCapabilities}
          loading={backendData.loading}
          error={backendData.error}
        />
      )}
      {activePage === "Scenarios" && (
        <ScenariosPage
          scenarioData={backendData.scenarioData}
          loading={backendData.loading}
          error={backendData.error}
        />
      )}
    </main>
  );
}
