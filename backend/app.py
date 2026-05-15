import os
import asyncio
import json
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import azure.cognitiveservices.speech as speechsdk

load_dotenv()

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_PREVIEW_API_VERSION", "2024-06-01")

AZURE_OPENAI_SYSTEM_MESSAGE = os.getenv(
    "AZURE_OPENAI_SYSTEM_MESSAGE",
    "You are an AI assistant that helps people find information."
)

AZURE_OPENAI_TEMPERATURE = float(os.getenv("AZURE_OPENAI_TEMPERATURE", "0"))
AZURE_OPENAI_TOP_P = float(os.getenv("AZURE_OPENAI_TOP_P", "1.0"))
AZURE_OPENAI_MAX_TOKENS = int(os.getenv("AZURE_OPENAI_MAX_TOKENS", "500"))

PORT = int(os.getenv("PORT", "50505"))

SAMPLE_RATE = 48000
CHANNELS = 1

app = FastAPI()


@app.get("/")
async def root():
    return JSONResponse({"status": "ok", "ws": f"ws://127.0.0.1:{PORT}/voice/ws"})


def _speech_config() -> speechsdk.SpeechConfig:
    config = speechsdk.SpeechConfig(subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION)

    # STT language
    config.speech_recognition_language = "en-US"  # promeni na "sr-RS" ako treba

    # Segmentation / silence tuning
    config.set_property(speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "650")
    config.set_property(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000")
    config.set_property(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1000")

    # TTS
    config.speech_synthesis_voice_name = "en-US-GuyNeural"
    config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
    )

    return config


async def azure_openai_chat(prompt: str) -> Optional[str]:
    try:
        url = (
            f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/"
            f"{AZURE_OPENAI_MODEL}/chat/completions"
            f"?api-version={AZURE_OPENAI_API_VERSION}"
        )
        headers = {"api-key": AZURE_OPENAI_KEY, "Content-Type": "application/json"}
        payload = {
            "messages": [
                {"role": "system", "content": AZURE_OPENAI_SYSTEM_MESSAGE},
                {"role": "user", "content": prompt},
            ],
            "temperature": AZURE_OPENAI_TEMPERATURE,
            "top_p": AZURE_OPENAI_TOP_P,
            "max_tokens": AZURE_OPENAI_MAX_TOKENS,
        }
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        if DEBUG:
            print("OpenAI error:", e)
        return None


async def azure_tts_synthesize(text: str) -> Optional[bytes]:
    try:
        config = _speech_config()
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=config, audio_config=None)

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: synthesizer.speak_text_async(text).get())

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return bytes(result.audio_data)
        if DEBUG:
            print("TTS not completed:", result.reason)
        return None
    except Exception as e:
        if DEBUG:
            print("TTS error:", e)
        return None


def _pcm16_rms_above_threshold(pcm16le: bytes, threshold: float = 1500.0) -> bool:
    """
    Fallback barge-in detekcija (gruba). Prag je namerno viši da ne reaguje na TTS bleed.
    Primarni barge-in je preko STT recognizing event-a.
    """
    if len(pcm16le) < 320:
        return False
    import struct
    n = min(len(pcm16le) // 2, 800)
    samples = struct.unpack("<" + "h" * n, pcm16le[: n * 2])
    acc = 0.0
    for s in samples:
        acc += float(s) * float(s)
    rms = (acc / n) ** 0.5
    return rms >= threshold


@app.websocket("/voice/ws")
async def voice_ws(ws: WebSocket):
    await ws.accept()
    print("WS otvoren (streaming STT)")

    # GLAVNI asyncio loop (kritično za Speech SDK callbacks)
    main_loop = asyncio.get_running_loop()

    agent_speaking = False
    tts_generation = 0
    stop_event = asyncio.Event()

    utterance_q: asyncio.Queue[str] = asyncio.Queue()

    speech_config = _speech_config()
    fmt = speechsdk.audio.AudioStreamFormat(
        samples_per_second=SAMPLE_RATE,
        bits_per_sample=16,
        channels=CHANNELS,
    )
    push_stream = speechsdk.audio.PushAudioInputStream(fmt)
    audio_input = speechsdk.audio.AudioConfig(stream=push_stream)
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_input)

    async def send_stop():
        try:
            await ws.send_text(json.dumps({"type": "stop"}))
        except Exception:
            pass

    # ✅ Primarni barge-in: STT partial dok agent govori
    def on_recognizing(evt: speechsdk.SpeechRecognitionEventArgs):
        nonlocal agent_speaking, tts_generation
        try:
            if not agent_speaking:
                return
            txt = (evt.result.text or "").strip()
            if not txt:
                return
            tts_generation += 1
            agent_speaking = False
            main_loop.call_soon_threadsafe(asyncio.create_task, send_stop())
        except Exception:
            pass

    # ✅ Final STT: svaki final ide kao novi turn
    def on_recognized(evt: speechsdk.SpeechRecognitionEventArgs):
        try:
            if evt.result.reason != speechsdk.ResultReason.RecognizedSpeech:
                return
            text = (evt.result.text or "").strip()
            if not text:
                return
            if DEBUG:
                print("STT final:", text)
            main_loop.call_soon_threadsafe(utterance_q.put_nowait, text)
        except Exception as e:
            if DEBUG:
                print("on_recognized error:", e)

    def on_canceled(evt: speechsdk.SpeechRecognitionCanceledEventArgs):
        if DEBUG:
            print("STT canceled:", evt.reason, evt.error_details)

    recognizer.recognizing.connect(on_recognizing)
    recognizer.recognized.connect(on_recognized)
    recognizer.canceled.connect(on_canceled)

    recognizer.start_continuous_recognition_async().get()

    async def agent_turn_worker():
        nonlocal agent_speaking, tts_generation
        try:
            while not stop_event.is_set():
                user_text = await utterance_q.get()

                # ako agent govori i dođe novi user turn -> stop playback + cancel
                if agent_speaking:
                    tts_generation += 1
                    agent_speaking = False
                    await send_stop()

                if DEBUG:
                    print("USER:", user_text)

                reply = await azure_openai_chat(user_text)
                if not reply:
                    if DEBUG:
                        print("AGENT: (no reply)")
                    continue

                if DEBUG:
                    print("AGENT:", reply)

                tts_generation += 1
                my_id = tts_generation
                agent_speaking = True

                audio = await azure_tts_synthesize(reply)

                # cancel ako je barge-in desio u međuvremenu
                if my_id != tts_generation:
                    agent_speaking = False
                    continue

                if audio:
                    await ws.send_bytes(audio)

                if my_id == tts_generation:
                    agent_speaking = False

        except Exception as e:
            if DEBUG:
                print("agent_turn_worker error:", e)

    worker_task = asyncio.create_task(agent_turn_worker())

    try:
        while True:
            # ✅ NOVO: primamo i text i bytes
            msg = await ws.receive()

            # 1) Control messages (client-side VAD signal)
            if "text" in msg and msg["text"] is not None:
                try:
                    data = json.loads(msg["text"])
                    if data.get("type") == "user_speaking":
                        if agent_speaking:
                            if DEBUG:
                                print("BARGE-IN: user_speaking")
                            tts_generation += 1
                            agent_speaking = False
                            await send_stop()
                        continue
                except Exception:
                    # ignore non-json texts
                    continue

            # 2) Audio bytes
            if "bytes" in msg and msg["bytes"] is not None:
                frame = msg["bytes"]

                # Fallback barge-in (samo ako agent govori i RMS je stvarno visok)
                if agent_speaking and _pcm16_rms_above_threshold(frame):
                    if DEBUG:
                        print("BARGE-IN: RMS")
                    tts_generation += 1
                    agent_speaking = False
                    await send_stop()

                push_stream.write(frame)

    except WebSocketDisconnect:
        print("WS zatvoren")
    except Exception as e:
        print("WS greška:", e)
    finally:
        stop_event.set()
        try:
            worker_task.cancel()
        except Exception:
            pass
        try:
            recognizer.stop_continuous_recognition_async().get()
        except Exception:
            pass
        try:
            push_stream.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
