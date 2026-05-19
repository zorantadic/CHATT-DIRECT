import os
import json
import asyncio
import tempfile
import base64
from provider_config import (
    get_active_provider_config,
    load_provider_capabilities,
    load_provider_config,
    save_provider_config,
    test_provider_config,
)
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from providers import get_realtime_provider_adapter
from provider_config import get_active_provider_config

load_dotenv()

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# ----------------------------
# Azure OpenAI Realtime config
# ----------------------------
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "gpt-realtime-mini")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-05-01-preview")
AZURE_OPENAI_PROFILE = os.getenv("AZURE_OPENAI_PROFILE", "byom-azure-openai-realtime")

PORT = int(os.getenv("PORT", "50505"))

# Flat-file stores
INSTRUCTIONS_PATH = os.getenv("INSTRUCTIONS_PATH", "instructions.json")

MAX_INSTRUCTIONS_LEN = int(os.getenv("MAX_INSTRUCTIONS_LEN", "8192"))

# Audio format expected by the desktop app events:
# - Realtime from Azure Realtime is pcm16 @ 24000 Hz
REALTIME_SAMPLE_RATE = int(os.getenv("REALTIME_SAMPLE_RATE", "24000"))
CHANNELS = int(os.getenv("AUDIO_CHANNELS", "1"))

# Allowed rates coming from the Desktop query params
ALLOWED_RATES: set[str] = {"1", "0.9", "0.8"}

app = FastAPI()

# NOTE: CORS applies to HTTP routes. WebSocket origin checks are not handled by CORSMiddleware,
# but keeping origins consistent with desktop/web helps with any fetches and diagnostics.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://gray-island-0de03d10f.1.azurestaticapps.net",
        "null",  # Electron file:// origin often shows up as "null" for HTTP fetches
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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


# ----------------------------
# Instructions Store (file + memory cache)
# ----------------------------
_instructions_lock = asyncio.Lock()

_instructions_cache: Dict[str, Dict[str, str]] = {
    "realtime": {"default": "", "current": "", "updatedAt": ""},
}
_instructions_file_updated_at: str = ""


def _validate_instructions_text(s: Any) -> str:
    if s is None:
        raise ValueError("current is required")
    s2 = str(s).strip()
    if len(s2) == 0:
        raise ValueError("current must not be empty")
    if len(s2) > MAX_INSTRUCTIONS_LEN:
        raise ValueError(f"current too long (max {MAX_INSTRUCTIONS_LEN})")
    return s2


def _coerce_target(t: Optional[str]) -> str:
    t2 = (t or "realtime").strip().lower()
    if t2 != "realtime":
        raise ValueError("invalid target (allowed: realtime)")
    return t2


def _default_instructions_fallback() -> str:
    return (
        "Speak slowly and clearly.\n"
        "No greeting.\n"
        "Be concise and structured.\n"
        "Answer only what is asked.\n"
        "Do not ask follow-up questions.\n"
        "Use a short structure: (1) Direct answer, (2) Key points (max 5), (3) Next steps (max 3)."
    )


def _ensure_instructions_file() -> None:
    default_fallback = _default_instructions_fallback()

    if not os.path.exists(INSTRUCTIONS_PATH):
        now = _now_iso()
        data = {
            "realtime": {"default": default_fallback, "current": default_fallback, "updatedAt": now},
            "updatedAt": now,
        }
        _atomic_write_json(INSTRUCTIONS_PATH, data)
        return

    try:
        data = _read_json_file(INSTRUCTIONS_PATH)

        # v2 schema; ignore legacy non-realtime blocks.
        if isinstance(data, dict) and "realtime" in data:
            now = _now_iso()
            block = data.get("realtime", {}) if isinstance(data.get("realtime", {}), dict) else {}
            d = str(block.get("default", default_fallback)).strip() or default_fallback
            c = str(block.get("current", d)).strip() or d
            u = str(block.get("updatedAt", now)).strip() or now
            out: Dict[str, Any] = {
                "realtime": {"default": d, "current": c, "updatedAt": u},
                "updatedAt": str(data.get("updatedAt", now)).strip() or now,
            }
            _atomic_write_json(INSTRUCTIONS_PATH, out)
            return

        # v1 schema
        d1 = str(data.get("default", default_fallback)).strip() or default_fallback
        c1 = str(data.get("current", d1)).strip() or d1
        u1 = str(data.get("updatedAt", _now_iso())).strip() or _now_iso()

        now = _now_iso()
        out2 = {
            "realtime": {"default": d1, "current": c1, "updatedAt": u1},
            "updatedAt": now,
        }
        _atomic_write_json(INSTRUCTIONS_PATH, out2)

    except Exception:
        now = _now_iso()
        data = {
            "realtime": {"default": default_fallback, "current": default_fallback, "updatedAt": now},
            "updatedAt": now,
        }
        _atomic_write_json(INSTRUCTIONS_PATH, data)


async def _load_instructions_to_cache() -> None:
    global _instructions_file_updated_at
    async with _instructions_lock:
        _ensure_instructions_file()
        data = _read_json_file(INSTRUCTIONS_PATH)
        now = _now_iso()

        block = data.get("realtime", {}) if isinstance(data.get("realtime", {}), dict) else {}
        _instructions_cache["realtime"]["default"] = str(block.get("default", "")).strip()
        _instructions_cache["realtime"]["current"] = str(block.get("current", "")).strip()
        _instructions_cache["realtime"]["updatedAt"] = str(block.get("updatedAt", now)).strip() or now

        _instructions_file_updated_at = str(data.get("updatedAt", now)).strip() or now


def _instructions_snapshot(target: str) -> Dict[str, Any]:
    return {
        "target": target,
        "current": _instructions_cache[target]["current"],
        "default": _instructions_cache[target]["default"],
        "updatedAt": _instructions_cache[target]["updatedAt"],
        "source": "file",
    }


# ----------------------------
# Startup
# ----------------------------
@app.on_event("startup")
async def _startup():
    await _load_instructions_to_cache()
    if DEBUG:
        print("[startup] Realtime endpoint:", AZURE_OPENAI_ENDPOINT)


# ----------------------------
# REST APIs
# ----------------------------
@app.get("/v1/instructions")
async def get_instructions(target: str = Query("realtime")):
    try:
        t = _coerce_target(target)
    except Exception as e:
        return JSONResponse({"error": "INVALID_TARGET", "message": str(e)}, status_code=400)

    async with _instructions_lock:
        return JSONResponse(_instructions_snapshot(t))


@app.put("/v1/instructions")
async def put_instructions(body: Dict[str, Any], target: str = Query("realtime")):
    try:
        t = _coerce_target(target)
        new_current = _validate_instructions_text(body.get("current"))
    except Exception as e:
        return JSONResponse({"error": "INVALID_INSTRUCTIONS", "message": str(e)}, status_code=400)

    async with _instructions_lock:
        now = _now_iso()
        data = {
            "realtime": _instructions_cache["realtime"].copy(),
            "updatedAt": now,
        }

        data[t]["current"] = new_current
        data[t]["updatedAt"] = now

        try:
            _atomic_write_json(INSTRUCTIONS_PATH, data)
        except Exception as e:
            return JSONResponse({"error": "INSTRUCTIONS_IO_ERROR", "message": str(e)}, status_code=500)

        _instructions_cache[t]["current"] = new_current
        _instructions_cache[t]["updatedAt"] = now
        return JSONResponse(_instructions_snapshot(t))


@app.post("/v1/instructions/reset")
async def reset_instructions(target: str = Query("realtime")):
    try:
        t = _coerce_target(target)
    except Exception as e:
        return JSONResponse({"error": "INVALID_TARGET", "message": str(e)}, status_code=400)

    async with _instructions_lock:
        now = _now_iso()
        data = {
            "realtime": _instructions_cache["realtime"].copy(),
            "updatedAt": now,
        }

        data[t]["current"] = data[t]["default"]
        data[t]["updatedAt"] = now

        try:
            _atomic_write_json(INSTRUCTIONS_PATH, data)
        except Exception as e:
            return JSONResponse({"error": "INSTRUCTIONS_IO_ERROR", "message": str(e)}, status_code=500)

        _instructions_cache[t]["current"] = data[t]["current"]
        _instructions_cache[t]["updatedAt"] = now
        return JSONResponse(_instructions_snapshot(t))

# ----------------------------
# Provider Configuration API
# ----------------------------
@app.get("/v1/provider/capabilities")
async def provider_capabilities():
    return load_provider_capabilities()


@app.get("/v1/provider/config")
async def provider_config_get():
    return load_provider_config()


@app.post("/v1/provider/config")
async def provider_config_save(payload: Dict[str, Any]):
    return save_provider_config(payload)


@app.get("/v1/provider/active")
async def provider_active_get():
    return get_active_provider_config()


@app.post("/v1/provider/test")
async def provider_config_test(payload: Optional[Dict[str, Any]] = None):
    return test_provider_config(payload)

@app.get("/")
async def root():
    return JSONResponse(
        {
            "status": "ok",
            "ws": f"ws://127.0.0.1:{PORT}/voice/ws",
            "instructions": f"http://127.0.0.1:{PORT}/v1/instructions?target=realtime",
            "instructions_targets": ["realtime"],
        }
    )


# ----------------------------
# Realtime WS bridge helpers
# ----------------------------
def _endpoint_host(endpoint: str) -> str:
    ep = (endpoint or "").strip()
    if not ep:
        return ""
    if "://" not in ep:
        # treat as host only
        parsed = urlparse("https://" + ep)
    else:
        parsed = urlparse(ep)
    # If endpoint was like "https://host/anything", take netloc.
    if parsed.netloc:
        return parsed.netloc
    # If endpoint was like "host" or "host/path" without scheme and parsing fell back oddly:
    return parsed.path.split("/")[0]


def _realtime_ws_url() -> str:
    host = _endpoint_host(AZURE_OPENAI_ENDPOINT)
    return (
        f"wss://{host}/voice-agent/realtime"
        f"?api-version={AZURE_OPENAI_API_VERSION}"
        f"&model={AZURE_OPENAI_MODEL}"
        f"&profile={AZURE_OPENAI_PROFILE}"
    )


def _normalize_rate(s: Optional[str]) -> str:
    r = (s or "1").strip()
    if r == "1.0":
        r = "1"
    if r not in ALLOWED_RATES:
        return "1"
    return r


async def _send_error(ws: WebSocket, message: str, **extra: Any) -> None:
    payload = {"type": "error", "message": message}
    if extra:
        payload.update(extra)
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass

# ----------------------------
# Voice WebSocket
# ----------------------------
@app.websocket("/voice/ws")
async def voice_ws(ws: WebSocket):
    await ws.accept()

    rate = _normalize_rate(ws.query_params.get("rate"))

    if DEBUG:
        print(f"[voice/ws] rate={rate}")

    async with _instructions_lock:
        realtime_instr = _instructions_cache["realtime"]["current"]
    if DEBUG:
     print("[DBG] file realtime default head:", _instructions_cache["realtime"]["default"][:120])
     print("[DBG] file realtime current  head:", _instructions_cache["realtime"]["current"][:120])

    active_provider = get_active_provider_config()
    provider_id = active_provider["activeProvider"]

    adapter = get_realtime_provider_adapter(provider_id)
    connection = adapter.build_connection(active_provider["config"])

    if not connection.url or not connection.headers:
        await _send_error(ws, f"Missing provider configuration for {provider_id}")
        await ws.close()
        return

    import websockets

    realtime_url = connection.url
    headers = connection.headers
    if DEBUG:
        print("[realtime] connect url:", realtime_url)

    async def safe_send(payload: dict):
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass

    async def apply_session_update(rws, voice_rate: str, instructions: Optional[str] = None):
        # Determine effective instructions (file current -> file default -> fallback).
        eff_instructions = (instructions or "").strip()
        if not eff_instructions:
            eff_instructions = (realtime_instr or "").strip()
        if not eff_instructions:
            eff_instructions = (_instructions_cache.get("realtime", {}).get("default") or "").strip()
        if not eff_instructions:
            eff_instructions = _default_instructions_fallback()
        if len(eff_instructions) > MAX_INSTRUCTIONS_LEN:
            eff_instructions = eff_instructions[:MAX_INSTRUCTIONS_LEN]
        if DEBUG:
            print("[DBG] session.update instructions head:", eff_instructions[:120])

        await rws.send(
            json.dumps(
                {
                    "type": "session.update",
                    "session": {
                        "turn_detection": {
                            "type": "server_vad",
                            "create_response": True,
                            "interrupt_response": True,
                        },
                        "modalities": ["audio"],
                        "input_audio_format": "pcm16",
                        "output_audio_format": "pcm16",
                        "voice": {
                            "name": "en-US-Ava:DragonHDLatestNeural",
                            "type": "azure-standard",
                            "rate": voice_rate,
                        },
                        "temperature": 0.8,
                        "instructions": eff_instructions,
                    },
                }
            )
        )

    async def append_audio_to_realtime(rws, audio_bytes: bytes):
        if not audio_bytes:
            return
        await rws.send(
            json.dumps(
                {
                    "type": "input_audio_buffer.append",
                    "audio": base64.b64encode(audio_bytes).decode("ascii"),
                }
            )
        )

    try:
        async with websockets.connect(realtime_url, extra_headers=headers) as rws:
            if DEBUG:
                print("Connected to Azure OpenAI Realtime:", realtime_url)

            await apply_session_update(rws, rate, realtime_instr)

            async def realtime_reader():
                try:
                    async for raw in rws:
                        if isinstance(raw, bytes):
                            continue
                        try:
                            msg = json.loads(raw)
                        except Exception:
                            continue

                        t = msg.get("type")
                        if t in {"response.audio.delta", "response.output_audio.delta"}:
                            b64 = msg.get("delta", "")
                            if b64:
                                await safe_send(
                                    {
                                        "type": "audio",
                                        "format": "pcm16",
                                        "sample_rate": REALTIME_SAMPLE_RATE,
                                        "channels": CHANNELS,
                                        "data": b64,
                                    }
                                )
                        elif t in {"response.audio.done", "response.output_audio.done"}:
                            await safe_send({"type": "agent_done"})
                        elif t in {
                            "input_audio_buffer.speech_started",
                            "input_audio_buffer.speech_stopped",
                            "input_audio_buffer.committed",
                        }:
                            if DEBUG:
                                print("[direct-realtime]", t, msg)
                            await safe_send({"type": "log", "message": f"direct realtime: {t}", "event": t})
                        elif t == "error":
                            if DEBUG:
                                print("[direct-realtime] error", msg)
                            await safe_send({"type": "error", "message": msg.get("message", "Realtime error"), "raw": msg})
                except Exception:
                    pass

            reader_task = asyncio.create_task(realtime_reader())

            try:
                while True:
                    try:
                        incoming = await ws.receive()
                    except (WebSocketDisconnect, RuntimeError):
                        break

                    audio_bytes = incoming.get("bytes")
                    if audio_bytes is not None:
                        try:
                            await append_audio_to_realtime(rws, audio_bytes)
                        except Exception as e:
                            if DEBUG:
                                print("append_audio_to_realtime error:", repr(e))
                            await safe_send({"type": "error", "message": str(e)})
                        continue

                    txt = incoming.get("text")
                    if not txt:
                        continue

                    try:
                        data = json.loads(txt)
                    except Exception:
                        continue

                    if data.get("type") == "response.cancel":
                        try:
                            await rws.send(json.dumps({"type": "response.cancel"}))
                        except Exception as e:
                            if DEBUG:
                                print("response.cancel error:", repr(e))
                            await safe_send({"type": "error", "message": str(e)})

                    elif data.get("type") == "refresh_instructions":
                        try:
                            async with _instructions_lock:
                                refreshed_instr = _instructions_cache["realtime"]["current"]

                            await apply_session_update(rws, rate, refreshed_instr)

                            await safe_send({
                                "type": "log",
                                "message": "Realtime session instructions refreshed"
                            })

                        except Exception as e:
                            if DEBUG:
                                print("refresh_instructions error:", repr(e))

                            await safe_send({
                                "type": "error",
                                "message": f"Instruction refresh failed: {str(e)}"
                            })

                    elif DEBUG and data.get("type") not in {"ping"}:
                        print("[direct-realtime] ignored desktop text frame:", data.get("type"))

            finally:
                try:
                    reader_task.cancel()
                except Exception:
                    pass

    except Exception as e:
        if DEBUG:
            print("Backend error:", repr(e))
        await safe_send({"type": "error", "message": str(e) or "Backend error"})
    finally:
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
