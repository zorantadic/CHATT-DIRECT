import json
import os
import tempfile
from copy import deepcopy
from typing import Any, Dict

from fastapi import HTTPException
from providers import get_realtime_provider_adapter


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

PROVIDER_CAPABILITIES_PATH = os.getenv(
    "PROVIDER_CAPABILITIES_PATH",
    os.path.join(BACKEND_DIR, "provider_capabilities.json"),
)

PROVIDER_CONFIG_PATH = os.getenv(
    "PROVIDER_CONFIG_PATH",
    os.path.join(BACKEND_DIR, "provider_config.local.json"),
)

PROVIDER_CONFIG_EXAMPLE_PATH = os.getenv(
    "PROVIDER_CONFIG_EXAMPLE_PATH",
    os.path.join(BACKEND_DIR, "provider_config.local.example.json"),
)


def _read_json_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _atomic_write_json(path: str, data: Dict[str, Any]) -> None:
    dir_name = os.path.dirname(os.path.abspath(path)) or "."
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=dir_name, delete=False) as tf:
        json.dump(data, tf, ensure_ascii=False, indent=2)
        tf.flush()
        os.fsync(tf.fileno())
        temp_name = tf.name

    os.replace(temp_name, path)


def load_provider_capabilities() -> Dict[str, Any]:
    try:
        data = _read_json_file(PROVIDER_CAPABILITIES_PATH)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="provider_capabilities.json not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"failed to read provider capabilities: {exc}")

    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="provider capabilities must be a JSON object")

    providers = data.get("providers")
    if not isinstance(providers, dict) or not providers:
        raise HTTPException(status_code=500, detail="provider capabilities missing providers")

    return data


def _load_provider_config_source() -> Dict[str, Any]:
    path = PROVIDER_CONFIG_PATH if os.path.exists(PROVIDER_CONFIG_PATH) else PROVIDER_CONFIG_EXAMPLE_PATH

    try:
        data = _read_json_file(path)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="provider config file not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"failed to read provider config: {exc}")

    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="provider config must be a JSON object")

    return data


def load_provider_config() -> Dict[str, Any]:
    return _load_provider_config_source()


def validate_provider_config(config: Dict[str, Any], capabilities: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="provider config must be a JSON object")

    caps = capabilities or load_provider_capabilities()
    supported_providers = caps.get("providers", {})

    active_provider = str(config.get("activeProvider", "")).strip()
    if not active_provider:
        raise HTTPException(status_code=400, detail="activeProvider is required")

    if active_provider not in supported_providers:
        raise HTTPException(status_code=400, detail=f"unsupported activeProvider: {active_provider}")

    providers = config.get("providers")
    if not isinstance(providers, dict):
        raise HTTPException(status_code=400, detail="providers must be a JSON object")

    if active_provider not in providers:
        raise HTTPException(status_code=400, detail=f"missing config for activeProvider: {active_provider}")

    for provider_id, provider_config in providers.items():
        if provider_id not in supported_providers:
            raise HTTPException(status_code=400, detail=f"unsupported provider in config: {provider_id}")
        if not isinstance(provider_config, dict):
            raise HTTPException(status_code=400, detail=f"provider config must be object: {provider_id}")

        provider_caps = supported_providers[provider_id]

        incoming = str(provider_config.get("incomingLanguage", "")).strip()
        outgoing = str(provider_config.get("outgoingLanguage", "")).strip()

        supported_incoming = {
            str(item.get("code", "")).strip()
            for item in provider_caps.get("supportedIncomingLanguages", [])
            if isinstance(item, dict)
        }
        supported_outgoing = {
            str(item.get("code", "")).strip()
            for item in provider_caps.get("supportedOutgoingLanguages", [])
            if isinstance(item, dict)
        }

        if incoming and supported_incoming and incoming not in supported_incoming:
            raise HTTPException(
                status_code=400,
                detail=f"incomingLanguage '{incoming}' is not supported for {provider_id}",
            )

        if outgoing and supported_outgoing and outgoing not in supported_outgoing:
            raise HTTPException(
                status_code=400,
                detail=f"outgoingLanguage '{outgoing}' is not supported for {provider_id}",
            )

    normalized = deepcopy(config)
    normalized["version"] = int(normalized.get("version", 1))
    return normalized


def save_provider_config(config: Dict[str, Any]) -> Dict[str, Any]:
    caps = load_provider_capabilities()
    normalized = validate_provider_config(config, caps)
    _atomic_write_json(PROVIDER_CONFIG_PATH, normalized)
    return normalized


def get_active_provider_config() -> Dict[str, Any]:
    caps = load_provider_capabilities()
    config = validate_provider_config(load_provider_config(), caps)
    active_provider = config["activeProvider"]

    return {
        "activeProvider": active_provider,
        "capabilities": caps["providers"][active_provider],
        "config": config["providers"][active_provider],
    }


def test_provider_config(config: Dict[str, Any] | None = None) -> Dict[str, Any]:
    caps = load_provider_capabilities()
    effective_config = validate_provider_config(config or load_provider_config(), caps)
    active_provider = effective_config["activeProvider"]
    provider_caps = caps["providers"][active_provider]
    provider_config = effective_config["providers"][active_provider]

    missing = []

    if provider_caps.get("requiresRegion") and not str(provider_config.get("region", "")).strip():
        missing.append("region")
    if provider_caps.get("requiresEndpoint") and not str(provider_config.get("endpoint", "")).strip():
        missing.append("endpoint")
    if provider_caps.get("requiresApiVersion") and not str(provider_config.get("apiVersion", "")).strip():
        missing.append("apiVersion")
    if provider_caps.get("requiresApiKey") and not str(provider_config.get("apiKey", "")).strip():
        missing.append("apiKey")
    if not str(provider_config.get("model", "")).strip():
        missing.append("model")
    if provider_caps.get("supportsVoice") and not str(provider_config.get("voice", "")).strip():
        missing.append("voice")

    if missing:
        return {
            "ok": False,
            "activeProvider": active_provider,
            "missing": missing,
            "message": "Provider config is incomplete.",
        }

    adapter = get_realtime_provider_adapter(active_provider)
    test_result = adapter.test_connection(provider_config)

    return {
        "activeProvider": active_provider,
        "missing": [],
        **test_result,
    }