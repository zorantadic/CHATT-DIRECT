import runtimeConfig from "../config/runtimeConfig.js";

function scenarioUrl(path) {
  return `${runtimeConfig.realtimeHttp.replace(/\/+$/, "")}${path}`;
}

async function getJson(path) {
  const response = await fetch(scenarioUrl(path));
  if (!response.ok) {
    throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  }
  return response.json();
}

export function getScenarios() {
  return getJson("/v1/scenarios");
}
