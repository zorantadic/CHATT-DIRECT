import asyncio
import socket
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RealtimeProviderConnection:
    url: str
    headers: dict[str, str]
    session_update: dict[str, Any]


class RealtimeProviderAdapter:
    provider_id: str

    def build_connection(self, provider_config: dict[str, Any]) -> RealtimeProviderConnection:
        raise NotImplementedError

    def build_session_update(self, voice_rate: str, instructions: str) -> dict[str, Any]:
        raise NotImplementedError

    async def test_connection(self, provider_config: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


async def _connect_websocket(url: str, headers: dict[str, str], timeout_seconds: float):
    import websockets

    try:
        async with websockets.connect(
            url,
            extra_headers=headers,
            open_timeout=timeout_seconds,
            close_timeout=timeout_seconds,
        ) as ws:
            await ws.close(code=1000, reason="provider-test")
    except TypeError as exc:
        if "extra_headers" not in str(exc):
            raise
        async with websockets.connect(
            url,
            additional_headers=headers,
            open_timeout=timeout_seconds,
            close_timeout=timeout_seconds,
        ) as ws:
            await ws.close(code=1000, reason="provider-test")


def _websocket_error_status(exc: Exception) -> int | None:
    status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    response = getattr(exc, "response", None)
    if status is None and response is not None:
        status = getattr(response, "status_code", None) or getattr(response, "status", None)
    try:
        return int(status) if status is not None else None
    except Exception:
        return None


def _websocket_error_message(provider_label: str, exc: Exception) -> str:
    status = _websocket_error_status(exc)
    detail = str(exc).strip() or exc.__class__.__name__

    if isinstance(exc, socket.gaierror):
        return f"{provider_label} Realtime websocket DNS lookup failed: {detail}"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return f"{provider_label} Realtime websocket connection timed out."
    if status in {401, 403}:
        return f"{provider_label} Realtime websocket authentication failed (HTTP {status}). Check API key and access."
    if status == 404:
        return f"{provider_label} Realtime websocket endpoint or model was not found (HTTP 404). Check endpoint and model."
    if status is not None:
        return f"{provider_label} Realtime websocket connect failed (HTTP {status}): {detail}"

    return f"{provider_label} Realtime websocket connect failed: {detail}"


async def probe_realtime_websocket(
    *,
    provider_id: str,
    provider_label: str,
    url: str,
    headers: dict[str, str],
    timeout_seconds: float = 10.0,
) -> dict[str, Any]:
    try:
        await _connect_websocket(url, headers, timeout_seconds)
    except Exception as exc:
        return {
            "ok": False,
            "message": _websocket_error_message(provider_label, exc),
            "provider": provider_id,
            "url": url,
        }

    return {
        "ok": True,
        "message": f"{provider_label} Realtime websocket connection succeeded.",
        "provider": provider_id,
        "url": url,
    }
