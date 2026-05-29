import os
from urllib.parse import quote

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
    probe_realtime_websocket,
)


class GoogleGeminiLiveAdapter(RealtimeProviderAdapter):
    provider_id = "google-gemini-live"

    def build_connection(self, provider_config: dict[str, str]) -> RealtimeProviderConnection:
        api_key = str(
            provider_config.get("apiKey")
            or os.getenv("GOOGLE_GEMINI_API_KEY", "")
        )

        model = str(
            provider_config.get("model")
            or os.getenv("GOOGLE_GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
        )

        key_param = quote(api_key, safe="")
        url = (
            "wss://generativelanguage.googleapis.com/ws/"
            "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
            f"?key={key_param}"
        )

        return RealtimeProviderConnection(
            url=url,
            headers={},
            session_update={},
        )

    def build_session_update(self, provider_config: dict[str, object], voice_rate: str, instructions: str) -> dict[str, object]:
        model = str(
            provider_config.get("model")
            or os.getenv("GOOGLE_GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
        ).strip() or "gemini-3.1-flash-live-preview"
        if not model.startswith("models/"):
            model = f"models/{model}"

        selected_voice = str(provider_config.get("voice") or "Kore").strip() or "Kore"
        safe_instructions = (instructions or "").strip()
        normalized_rate = str(voice_rate or "1").strip()
        if normalized_rate == "1.0":
            normalized_rate = "1"

        pacing_rule = ""
        if normalized_rate == "0.9":
            pacing_rule = (
                "VOICE PACING RULE:\n"
                "Speak slightly slower than normal while keeping a natural conversational pace. "
                "Use short pauses between sentences."
            )
        elif normalized_rate == "0.8":
            pacing_rule = (
                "VOICE PACING RULE:\n"
                "Speak slowly and clearly. Use a calm pace, noticeable pauses between sentences, "
                "and slightly longer pauses inside complex sentences."
            )

        if pacing_rule:
            safe_instructions = f"{safe_instructions}\n\n{pacing_rule}" if safe_instructions else pacing_rule

        return {
            "setup": {
                "model": model,
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": selected_voice,
                            }
                        }
                    },
                },
                "realtimeInputConfig": {
                    "automaticActivityDetection": {
                        "disabled": False,
                        "prefixPaddingMs": 500,
                        "silenceDurationMs": 1500,
                    },
                    "activityHandling": "START_OF_ACTIVITY_INTERRUPTS",
                },
                "systemInstruction": {
                    "parts": [
                        {
                            "text": safe_instructions,
                        }
                    ]
                },
            }
        }

    async def test_connection(self, provider_config: dict[str, object]) -> dict[str, object]:
        connection = self.build_connection(provider_config)

        api_key = str(
            provider_config.get("apiKey")
            or os.getenv("GOOGLE_GEMINI_API_KEY", "")
        ).strip()
        if not api_key:
            return {
                "ok": False,
                "message": "Google Gemini API key is missing.",
            }

        if not connection.url:
            return {
                "ok": False,
                "message": "Google Gemini Live websocket URL is missing.",
            }

        return await probe_realtime_websocket(
            provider_id=self.provider_id,
            provider_label="Google Gemini Live",
            url=connection.url,
            headers=connection.headers,
        )
