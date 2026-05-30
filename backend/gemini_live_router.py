import asyncio
import base64
import json
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from gemini_audio import pcm16_mono_24k_to_16k
from provider_config import get_active_provider_config
from providers import get_realtime_provider_adapter

load_dotenv()

DEBUG = os.getenv("DEBUG", "False").lower() == "true"
INSTRUCTIONS_PATH = os.getenv("INSTRUCTIONS_PATH", "instructions.json")
MAX_INSTRUCTIONS_LEN = int(os.getenv("MAX_INSTRUCTIONS_LEN", "8192"))
ALLOWED_RATES: set[str] = {"1", "0.9", "0.8"}
DESKTOP_OUTPUT_SAMPLE_RATE = 24000
DESKTOP_CHANNELS = 1

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _default_instructions_fallback() -> str:
    return (
        "Speak slowly and clearly.\n"
        "No greeting.\n"
        "Be concise and structured.\n"
        "Answer only what is asked.\n"
        "Do not ask follow-up questions.\n"
        "Use a short structure: (1) Direct answer, (2) Key points (max 5), (3) Next steps (max 3)."
    )


def _read_json_file(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _normalize_rate(value: str | None) -> str:
    rate = (value or "1").strip()
    if rate == "1.0":
        rate = "1"
    return rate if rate in ALLOWED_RATES else "1"


def _load_realtime_instructions() -> str:
    fallback = _default_instructions_fallback()

    try:
        data = _read_json_file(INSTRUCTIONS_PATH)
    except Exception:
        return fallback

    if not isinstance(data, dict):
        return fallback

    if "realtime" in data and isinstance(data.get("realtime"), dict):
        block = data.get("realtime", {})
        current = str(block.get("current", "")).strip()
        default = str(block.get("default", "")).strip()
        return current or default or fallback

    current = str(data.get("current", "")).strip()
    default = str(data.get("default", "")).strip()
    return current or default or fallback


def _effective_instructions(active_provider: dict[str, Any], explicit_instructions: str | None = None) -> str:
    instructions = (explicit_instructions or "").strip() or _load_realtime_instructions()
    if not instructions:
        instructions = _default_instructions_fallback()

    outgoing_language = str(active_provider["config"].get("outgoingLanguage") or "").strip()
    if outgoing_language:
        instructions = (
            f"{instructions}\n\n"
            "LANGUAGE RULE:\n"
            f"Always answer in the selected outgoing language code: {outgoing_language}."
        )

    if len(instructions) > MAX_INSTRUCTIONS_LEN:
        instructions = instructions[:MAX_INSTRUCTIONS_LEN]

    return instructions


async def _send_error(ws: WebSocket, message: str, **extra: Any) -> None:
    payload = {"type": "error", "message": message}
    if extra:
        payload.update(extra)
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass


async def _connect_upstream(url: str):
    import websockets

    return await websockets.connect(
        url,
        open_timeout=15,
        close_timeout=15,
    )


def _gemini_repeat_prompt_message() -> dict[str, Any]:
    return {
        "clientContent": {
            "turns": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": "Please repeat your last answer.",
                        }
                    ],
                }
            ],
            "turnComplete": True,
        }
    }


@router.websocket("/gemini/voice/ws")
async def gemini_voice_ws(ws: WebSocket):
    await ws.accept()

    rate = _normalize_rate(ws.query_params.get("rate"))

    async def safe_send(payload: dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass

    try:
        active_provider = get_active_provider_config()
        provider_id = active_provider["activeProvider"]

        if provider_id != "google-gemini-live":
            await _send_error(
                ws,
                f"Gemini route requires activeProvider=google-gemini-live. Current activeProvider={provider_id}",
            )
            await ws.close()
            return

        adapter = get_realtime_provider_adapter(provider_id)
        connection = adapter.build_connection(active_provider["config"])
        if not connection.url:
            await _send_error(ws, "Missing Gemini Live websocket URL.")
            await ws.close()
            return

        rws = await _connect_upstream(connection.url)
        try:
            await safe_send({"type": "log", "message": "Gemini route accepted; upstream WebSocket connected"})

            instructions = _effective_instructions(active_provider)
            setup_payload = adapter.build_session_update(
                provider_config=active_provider["config"],
                voice_rate=rate,
                instructions=instructions,
            )
            await rws.send(json.dumps(setup_payload))
            await safe_send({"type": "log", "message": "Gemini setup sent"})

            logged_first_audio_in = False
            logged_first_audio_out = False
            logged_first_server_msg = False
            logged_upstream_parse_error = False
            setup_complete_wait_logged = False
            setup_complete_audio_gate_failed = False
            setup_complete_event = asyncio.Event()

            async def upstream_reader():
                nonlocal logged_first_server_msg, logged_upstream_parse_error

                try:
                    async for raw in rws:
                        if isinstance(raw, bytes):
                            try:
                                raw = raw.decode("utf-8")
                            except Exception:
                                if not logged_upstream_parse_error:
                                    logged_upstream_parse_error = True
                                    await safe_send({
                                        "type": "log",
                                        "message": "Gemini upstream message decode/parse failed; message ignored",
                                    })
                                continue

                        try:
                            msg = json.loads(raw)
                        except Exception:
                            if not logged_upstream_parse_error:
                                logged_upstream_parse_error = True
                                await safe_send({
                                    "type": "log",
                                    "message": "Gemini upstream message decode/parse failed; message ignored",
                                })
                            continue

                        if not logged_first_server_msg:
                            logged_first_server_msg = True
                            keys = ",".join(str(k) for k in msg.keys())
                            await safe_send({
                                "type": "log",
                                "message": f"Gemini first server message keys: {keys or '(none)'}",
                            })

                        if msg.get("setupComplete") is not None:
                            await safe_send({"type": "log", "message": "Gemini session setup complete"})
                            setup_complete_event.set()
                            continue

                        server_content = msg.get("serverContent")
                        if isinstance(server_content, dict):
                            model_turn = server_content.get("modelTurn")
                            if isinstance(model_turn, dict):
                                parts = model_turn.get("parts") or []
                                for part in parts:
                                    if not isinstance(part, dict):
                                        continue
                                    inline_data = part.get("inlineData")
                                    if not isinstance(inline_data, dict):
                                        continue
                                    mime_type = str(inline_data.get("mimeType") or "").strip().lower()
                                    data = str(inline_data.get("data") or "").strip()
                                    if data and mime_type.startswith("audio/pcm"):
                                        await safe_send(
                                            {
                                                "type": "audio",
                                                "format": "pcm16",
                                                "sample_rate": DESKTOP_OUTPUT_SAMPLE_RATE,
                                                "channels": DESKTOP_CHANNELS,
                                                "data": data,
                                            }
                                        )

                            if server_content.get("interrupted") is True:
                                await safe_send({
                                    "type": "interrupted",
                                    "message": "Gemini generation interrupted",
                                })

                            if server_content.get("turnComplete") is True:
                                await safe_send({"type": "agent_done"})
                            continue

                        if msg.get("goAway") is not None:
                            await safe_send({"type": "log", "message": "Gemini server requested disconnect"})
                            continue

                        if msg.get("toolCall") is not None or msg.get("toolCallCancellation") is not None:
                            await safe_send({"type": "log", "message": "Gemini tool event ignored in current runtime"})
                            continue

                        if DEBUG:
                            await safe_send({"type": "log", "message": f"Gemini message ignored: {','.join(msg.keys())}"})
                except Exception as exc:
                    await safe_send({"type": "error", "message": str(exc) or "Gemini upstream reader error"})

            reader_task = asyncio.create_task(upstream_reader())

            try:
                while True:
                    try:
                        incoming = await ws.receive()
                    except (WebSocketDisconnect, RuntimeError):
                        break

                    audio_bytes = incoming.get("bytes")
                    if audio_bytes is not None:
                        if not logged_first_audio_in:
                            logged_first_audio_in = True
                            await safe_send({
                                "type": "log",
                                "message": f"Gemini first Desktop audio frame received bytes={len(audio_bytes)}",
                            })

                        downsampled = pcm16_mono_24k_to_16k(audio_bytes)
                        if not downsampled:
                            continue

                        if not logged_first_audio_out and not setup_complete_event.is_set():
                            if setup_complete_audio_gate_failed:
                                continue

                            if not setup_complete_wait_logged:
                                setup_complete_wait_logged = True
                                await safe_send({
                                    "type": "log",
                                    "message": "Gemini waiting for setupComplete before first audio send",
                                })

                            try:
                                await asyncio.wait_for(setup_complete_event.wait(), timeout=10)
                            except asyncio.TimeoutError:
                                setup_complete_audio_gate_failed = True
                                await safe_send({
                                    "type": "error",
                                    "message": "Gemini setupComplete was not received before audio send.",
                                })
                                continue

                        payload = {
                            "realtimeInput": {
                                "audio": {
                                    "data": base64.b64encode(downsampled).decode("ascii"),
                                    "mimeType": "audio/pcm;rate=16000",
                                }
                            }
                        }
                        await rws.send(json.dumps(payload))
                        if not logged_first_audio_out:
                            logged_first_audio_out = True
                            await safe_send({
                                "type": "log",
                                "message": f"Gemini first downsampled audio frame sent after setupComplete bytes={len(downsampled)}",
                            })
                        continue

                    txt = incoming.get("text")
                    if not txt:
                        continue

                    try:
                        data = json.loads(txt)
                    except Exception:
                        continue

                    msg_type = data.get("type")

                    if msg_type == "response.cancel":
                        await safe_send({
                            "type": "log",
                            "message": "Gemini cancel is not mapped yet; request ignored safely.",
                        })
                    elif msg_type == "repeat_last_answer":
                        await rws.send(json.dumps(_gemini_repeat_prompt_message()))
                        await safe_send({
                            "type": "log",
                            "message": "Repeat Last Answer requested",
                        })
                    elif msg_type == "refresh_instructions":
                        refreshed_provider = get_active_provider_config()
                        refreshed_instructions = _effective_instructions(refreshed_provider)
                        refreshed_setup = adapter.build_session_update(
                            provider_config=refreshed_provider["config"],
                            voice_rate=rate,
                            instructions=refreshed_instructions,
                        )
                        await rws.send(json.dumps(refreshed_setup))
                        await safe_send({
                            "type": "log",
                            "message": "Gemini session instructions refreshed",
                        })
                    elif DEBUG and msg_type not in {"ping"}:
                        await safe_send({"type": "log", "message": f"Gemini desktop frame ignored: {msg_type}"})
            finally:
                try:
                    reader_task.cancel()
                except Exception:
                    pass
        finally:
            try:
                await rws.close()
            except Exception:
                pass
    except Exception as exc:
        await safe_send({
            "type": "error",
            "message": str(exc) or "Gemini backend error",
        })
    finally:
        try:
            await ws.close()
        except Exception:
            pass
