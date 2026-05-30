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
                "RUNTIME VOICE DELIVERY OVERRIDE:\n\n"
                "This instruction controls spoken delivery only, not answer length or content.\n\n"
                "Keep all behavior, role, silence rules, and answer rules from the main system instruction.\n\n"
                "When you speak, use a slower-than-normal conversational pace.\n\n"
                "Do not rush the first words of the answer.\n\n"
                "Pause briefly after every sentence.\n\n"
                "Pause slightly before important points, names, numbers, acronyms, and technical terms.\n\n"
                "Keep words clearly separated. Do not run phrases together.\n\n"
                "Target a calm, measured delivery around 110 to 125 words per minute.\n\n"
                "Use natural human pacing. Do not sound robotic or exaggerated."
            )
        elif normalized_rate == "0.8":
            pacing_rule = (
                "RUNTIME VOICE DELIVERY OVERRIDE:\n\n"
                "This instruction controls spoken delivery only, not answer length or content.\n\n"
                "Keep all behavior, role, silence rules, and answer rules from the main system instruction.\n\n"
                "You must deliberately slow down the spoken delivery.\n\n"
                "Before starting the answer, insert a short thinking pause.\n\n"
                "Speak as if dictating important notes to a listener.\n\n"
                "Keep words clearly separated. Do not run words together.\n\n"
                "Pause after every sentence.\n\n"
                "Pause briefly before important points, names, numbers, acronyms, and technical terms.\n\n"
                "When explaining technical content, speak one idea at a time.\n\n"
                "Do not compress or rush the spoken delivery, even when the answer is short.\n\n"
                "Target a slow, easy-to-follow delivery around 90 to 105 words per minute.\n\n"
                "If you feel you are speaking at a normal conversational speed, you are speaking too fast.\n\n"
                "Use natural human pacing. Do not sound robotic or theatrical."
            )

        system_parts = []
        if safe_instructions:
            system_parts.append({"text": safe_instructions})
        if pacing_rule:
            system_parts.append({"text": pacing_rule})
        if not system_parts:
            system_parts.append({"text": ""})

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
                    "parts": system_parts
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
