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

        return {
            "setup": {
                "model": model,
                "systemInstruction": {
                    "parts": [
                        {
                            "text": (instructions or "").strip(),
                        }
                    ]
                },
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
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
