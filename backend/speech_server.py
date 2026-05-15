from dotenv import load_dotenv
load_dotenv()

import os
import json
import asyncio
from typing import Dict, Optional, List

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import azure.cognitiveservices.speech as speechsdk


# ------------------------------------------------------------
# APP
# ------------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # MUST be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# ENV (required)
# ------------------------------------------------------------
AZURE_SPEECH_KEY = os.environ["AZURE_SPEECH_KEY"]
AZURE_SPEECH_REGION = os.environ["AZURE_SPEECH_REGION"]

STT_DEFAULT_LANGUAGE = os.getenv("STT_DEFAULT_LANGUAGE", "en-US").strip()

SUPPORTED_LANGS = {"en-US", "sr-RS", "hr-HR", "es-ES", "de-DE"}
if STT_DEFAULT_LANGUAGE not in SUPPORTED_LANGS:
    STT_DEFAULT_LANGUAGE = "en-US"


# ------------------------------------------------------------
# ENV (tuning) - set in Container App
# ------------------------------------------------------------
STT_SEGMENTATION_STRATEGY = os.getenv("STT_SEGMENTATION_STRATEGY", "Semantic").strip()
if STT_SEGMENTATION_STRATEGY not in {"Default", "Time", "Semantic"}:
    STT_SEGMENTATION_STRATEGY = "Default"

STT_SEGMENTATION_SILENCE_TIMEOUT_MS = int(os.getenv("STT_SEGMENTATION_SILENCE_TIMEOUT_MS", "2000").strip())
STT_END_SILENCE_TIMEOUT_MS = int(os.getenv("STT_END_SILENCE_TIMEOUT_MS", "2500").strip())
STT_INITIAL_SILENCE_TIMEOUT_MS = int(os.getenv("STT_INITIAL_SILENCE_TIMEOUT_MS", "4000").strip())
STT_SEGMENTATION_MAXIMUM_TIME_MS = int(os.getenv("STT_SEGMENTATION_MAXIMUM_TIME_MS", "45000").strip())

# Keep env var for compatibility, but do NOT set RecoMode property in SDK
STT_RECO_MODE = os.getenv("STT_RECO_MODE", "Conversation").strip()

STT_STABLE_PARTIAL_THRESHOLD = int(os.getenv("STT_STABLE_PARTIAL_THRESHOLD", "3").strip())

STT_CONTEXT_FLUSH_SILENCE_MS = int(
    os.getenv("STT_CONTEXT_FLUSH_SILENCE_MS", str(STT_END_SILENCE_TIMEOUT_MS)).strip()
)


def _safe_set(cfg: speechsdk.SpeechConfig, prop_id, value: str) -> None:
    try:
        cfg.set_property(prop_id, value)
    except Exception:
        pass


def make_speech_config() -> speechsdk.SpeechConfig:
    cfg = speechsdk.SpeechConfig(subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION)

    _safe_set(cfg, speechsdk.PropertyId.Speech_SegmentationStrategy, STT_SEGMENTATION_STRATEGY)

    _safe_set(cfg, speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, str(STT_SEGMENTATION_SILENCE_TIMEOUT_MS))
    _safe_set(cfg, speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, str(STT_END_SILENCE_TIMEOUT_MS))
    _safe_set(cfg, speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, str(STT_INITIAL_SILENCE_TIMEOUT_MS))

    # Apply ONLY for Time strategy
    if STT_SEGMENTATION_STRATEGY == "Time":
        _safe_set(cfg, speechsdk.PropertyId.Speech_SegmentationMaximumTimeMs, str(STT_SEGMENTATION_MAXIMUM_TIME_MS))

    _safe_set(cfg, speechsdk.PropertyId.SpeechServiceResponse_StablePartialResultThreshold, str(STT_STABLE_PARTIAL_THRESHOLD))

    # IMPORTANT: do NOT set SpeechServiceConnection_RecoMode
    return cfg


_active_sessions: Dict[str, speechsdk.SpeechRecognizer] = {}


@app.websocket("/stt/ws/{session_id}")
async def stt_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    loop = asyncio.get_running_loop()

    requested_lang: Optional[str] = ws.query_params.get("lang")
    if requested_lang:
        requested_lang = requested_lang.strip()

    effective_lang = requested_lang if (requested_lang in SUPPORTED_LANGS) else STT_DEFAULT_LANGUAGE

    audio_format = speechsdk.audio.AudioStreamFormat(
        samples_per_second=16000,
        bits_per_sample=16,
        channels=1,
    )
    push_stream = speechsdk.audio.PushAudioInputStream(audio_format)
    audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

    speech_config = make_speech_config()
    speech_config.speech_recognition_language = effective_lang

    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )

    _active_sessions[session_id] = recognizer

    buffer_lock = asyncio.Lock()
    buffered_segments: List[str] = []
    flush_task: Optional[asyncio.Task] = None

    async def flush_after_silence():
        try:
            await asyncio.sleep(STT_CONTEXT_FLUSH_SILENCE_MS / 1000.0)

            async with buffer_lock:
                if not buffered_segments:
                    return
                merged = " ".join(s.strip() for s in buffered_segments if s and s.strip()).strip()
                buffered_segments.clear()

            if merged:
                payload = {
                    "type": "STT_FINAL",
                    "sessionId": session_id,
                    "transcript": merged,
                    "lang": effective_lang,
                }
                await ws.send_text(json.dumps(payload))

        except asyncio.CancelledError:
            return
        except Exception as e:
            try:
                await ws.send_text(json.dumps({"type": "STT_ERROR", "sessionId": session_id, "error": f"flush_error: {e}"}))
            except Exception:
                pass

    async def on_final_text(text: str):
        nonlocal flush_task
        async with buffer_lock:
            buffered_segments.append(text)

            if flush_task and not flush_task.done():
                flush_task.cancel()
            flush_task = asyncio.create_task(flush_after_silence())

    await ws.send_text(
        json.dumps(
            {
                "type": "STT_MODE",
                "sessionId": session_id,
                "mode": "semantic+buffered_context",
                "language": effective_lang,
                "supported": sorted(list(SUPPORTED_LANGS)),
                "segmentationStrategy": STT_SEGMENTATION_STRATEGY,
                "segmentationSilenceTimeoutMs": STT_SEGMENTATION_SILENCE_TIMEOUT_MS,
                "endSilenceTimeoutMs": STT_END_SILENCE_TIMEOUT_MS,
                "initialSilenceTimeoutMs": STT_INITIAL_SILENCE_TIMEOUT_MS,
                "segmentationMaximumTimeMs": (STT_SEGMENTATION_MAXIMUM_TIME_MS if STT_SEGMENTATION_STRATEGY == "Time" else None),
                "stablePartialThreshold": STT_STABLE_PARTIAL_THRESHOLD,
                "contextFlushSilenceMs": STT_CONTEXT_FLUSH_SILENCE_MS,
            }
        )
    )

    def on_recognized(evt):
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text = (evt.result.text or "").strip()
            if text:
                asyncio.run_coroutine_threadsafe(on_final_text(text), loop)

    def on_canceled(evt):
        # Pull cancellation details from SDK
        reason = "unknown"
        error_code = "unknown"
        details = ""

        try:
            cd = evt.result.cancellation_details
            try:
                reason = str(cd.reason)
            except Exception:
                pass
            try:
                error_code = str(cd.error_code)
            except Exception:
                pass
            try:
                details = cd.error_details or ""
            except Exception:
                details = ""
        except Exception:
            pass

        # Put everything into ONE string so renderer shows it without changes
        msg = f"canceled reason={reason} errorCode={error_code} details={details}"

        # Also print to container logs (Portal Log stream)
        try:
            print(f"STT_CANCELED session={session_id} lang={effective_lang} {msg}", flush=True)
        except Exception:
            pass

        payload = {
            "type": "STT_ERROR",
            "sessionId": session_id,
            "error": msg,
        }

        try:
            asyncio.run_coroutine_threadsafe(ws.send_text(json.dumps(payload)), loop)
        except Exception:
            pass

    recognizer.recognized.connect(on_recognized)
    recognizer.canceled.connect(on_canceled)

    recognizer.start_continuous_recognition()

    try:
        while True:
            data = await ws.receive_bytes()
            push_stream.write(data)
    except Exception:
        pass
    finally:
        try:
            recognizer.stop_continuous_recognition()
        except Exception:
            pass

        try:
            if flush_task and not flush_task.done():
                flush_task.cancel()
        except Exception:
            pass

        try:
            push_stream.close()
        except Exception:
            pass

        _active_sessions.pop(session_id, None)
