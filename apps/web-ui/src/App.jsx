import React, { useEffect, useMemo, useState } from "react";
import { getProviderCapabilities, getProviderConfig } from "./api/providerClient.js";
import { getScenarios } from "./api/scenarioClient.js";
import BottomStatusBar from "./components/BottomStatusBar.jsx";
import Shell from "./components/Shell.jsx";
import runtimeConfig from "./config/runtimeConfig.js";
import ScenariosPage from "./pages/ScenariosPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import VoicePage from "./pages/VoicePage.jsx";

const pages = [
  { id: "voice", label: "Voice" },
  { id: "settings", label: "Settings" },
  { id: "scenarios", label: "Scenarios" },
];

function textValue(value, fallback = "Not loaded") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function firstObjectKey(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.keys(value)[0] || "";
}

function optionLabel(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return textValue(value.label || value.name || value.displayName || value.value || value.id, "");
  }
  return textValue(value, "");
}

function firstOptionLabel(values) {
  return Array.isArray(values) && values.length ? optionLabel(values[0]) : "";
}

function providerDisplayName(providerId, providerCapabilities) {
  const caps = providerCapabilities?.providers?.[providerId];
  return textValue(caps?.displayName || caps?.label || caps?.name || providerId);
}

function selectedProviderState(providerConfig, providerCapabilities) {
  const providerId = textValue(
    providerConfig?.activeProvider ||
      providerCapabilities?.defaultProvider ||
      firstObjectKey(providerCapabilities?.providers),
    "",
  );
  const providerEntry = providerId ? providerConfig?.providers?.[providerId] || {} : {};
  const providerCaps = providerId ? providerCapabilities?.providers?.[providerId] || {} : {};

  return {
    id: providerId,
    displayName: providerDisplayName(providerId, providerCapabilities),
    model: textValue(providerEntry.model || providerCaps.defaultModel),
    voice: textValue(providerEntry.voice || providerCaps.defaultVoice),
    incomingLanguage: textValue(providerEntry.incomingLanguage || providerCaps.defaultIncomingLanguage),
    outgoingLanguage: textValue(providerEntry.outgoingLanguage || providerCaps.defaultOutgoingLanguage),
    endpoint: textValue(providerEntry.endpoint, "Not configured"),
    region: textValue(
      providerEntry.region || providerCaps.defaultRegion || firstOptionLabel(providerCaps.supportedRegions),
      "Not configured",
    ),
    apiVersion: textValue(providerEntry.apiVersion || providerCaps.defaultApiVersion, "Not configured"),
    modelLabel: textValue(providerCaps.modelLabel, "Deployment / Model"),
    requiresEndpoint: Boolean(providerCaps.requiresEndpoint),
    requiresRegion: Boolean(providerCaps.requiresRegion),
  };
}

function normalizeScenario(rawScenario) {
  if (!rawScenario || typeof rawScenario !== "object") return null;
  const id = textValue(rawScenario.id, "");
  if (!id) return null;

  return {
    id,
    name: textValue(rawScenario.name || id),
    category: textValue(rawScenario.category, "Not provided"),
    shortDescription: textValue(rawScenario.shortDescription, "Not provided"),
    displayDetails: textValue(rawScenario.displayDetails, "Not provided"),
    recommendedUse: textValue(rawScenario.recommendedUse, "Not provided"),
    instruction: textValue(rawScenario.instruction, ""),
    userInstruction: textValue(rawScenario.userInstruction, ""),
    userInstructionUpdatedAt: textValue(rawScenario.userInstructionUpdatedAt, "Not provided"),
  };
}

function selectedScenarioState(scenarioData) {
  const scenarios = Array.isArray(scenarioData?.scenarios)
    ? scenarioData.scenarios.map(normalizeScenario).filter(Boolean)
    : [];
  const defaultScenarioId = textValue(scenarioData?.defaultScenarioId, "");
  const activeScenarioId = textValue(scenarioData?.activeScenarioId || defaultScenarioId || scenarios[0]?.id, "");
  const selected =
    scenarios.find((scenario) => scenario.id === activeScenarioId) ||
    scenarios.find((scenario) => scenario.id === defaultScenarioId) ||
    scenarios[0] ||
    null;
  const hasCustomInstruction = Boolean(selected?.userInstruction);

  return {
    scenarios,
    selected,
    activeScenarioId,
    defaultScenarioId,
    instructionText: selected ? selected.userInstruction || selected.instruction : "",
    defaultInstruction: selected?.instruction || "",
    instructionSource: selected
      ? hasCustomInstruction
        ? "Custom override"
        : "Scenario default"
      : "Not provided",
    instructionOverrideLabel: selected
      ? hasCustomInstruction
        ? "Custom override loaded"
        : "Scenario default"
      : "Override unknown",
    hasCustomInstruction,
  };
}

function hostLabel(url) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export default function App() {
  const [activePage, setActivePage] = useState("voice");
  const [backendData, setBackendData] = useState({
    loading: true,
    error: "",
    providerConfig: null,
    providerCapabilities: null,
    scenarioData: null,
  });

  useEffect(() => {
    document.body.dataset.session = "off";
    document.body.dataset.activity = "idle";
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBackendData() {
      const [providerConfig, providerCapabilities, scenarioData] = await Promise.allSettled([
        getProviderConfig(),
        getProviderCapabilities(),
        getScenarios(),
      ]);

      if (!mounted) return;

      const errors = [
        ["Provider config", providerConfig],
        ["Provider capabilities", providerCapabilities],
        ["Scenarios", scenarioData],
      ]
        .filter(([, result]) => result.status === "rejected")
        .map(([label, result]) => `${label}: ${result.reason?.message || String(result.reason)}`);

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

  const providerState = useMemo(
    () => selectedProviderState(backendData.providerConfig, backendData.providerCapabilities),
    [backendData.providerCapabilities, backendData.providerConfig],
  );

  const scenarioState = useMemo(
    () => selectedScenarioState(backendData.scenarioData),
    [backendData.scenarioData],
  );

  const connectionState = {
    realtimeHttp: runtimeConfig.realtimeHttp,
    realtimeWs: runtimeConfig.realtimeWs,
    backendLabel: hostLabel(runtimeConfig.realtimeHttp),
    wsLabel: runtimeConfig.realtimeWs,
    loading: backendData.loading,
    error: backendData.error,
  };

  return (
    <Shell activePage={activePage} onPageChange={setActivePage} pages={pages}>
      {activePage === "voice" && (
        <VoicePage
          connectionState={connectionState}
          loading={backendData.loading}
          providerState={providerState}
          scenarioState={scenarioState}
          error={backendData.error}
        />
      )}
      {activePage === "settings" && (
        <SettingsPage
          connectionState={connectionState}
          loading={backendData.loading}
          providerState={providerState}
          error={backendData.error}
        />
      )}
      {activePage === "scenarios" && (
        <ScenariosPage
          connectionState={connectionState}
          loading={backendData.loading}
          scenarioState={scenarioState}
          error={backendData.error}
        />
      )}
      <BottomStatusBar connectionState={connectionState} />
    </Shell>
  );
}
