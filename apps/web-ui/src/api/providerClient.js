import runtimeConfig from "../config/runtimeConfig.js";

function providerUrl(path) {
  return `${runtimeConfig.realtimeHttp.replace(/\/+$/, "")}${path}`;
}

async function getJson(path) {
  const response = await fetch(providerUrl(path));
  if (!response.ok) {
    throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  }
  return response.json();
}

export function getProviderConfig() {
  return getJson("/v1/provider/config");
}

export function getProviderCapabilities() {
  return getJson("/v1/provider/capabilities");
}
