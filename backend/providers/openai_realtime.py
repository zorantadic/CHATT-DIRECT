import os

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
    probe_realtime_websocket,
)


class OpenAIRealtimeAdapter(RealtimeProviderAdapter):
    provider_id = "openai-realtime"

    def build_connection(self, provider_config: dict[str, str]) -> RealtimeProviderConnection:
        api_key = str(
            provider_config.get("apiKey")
            or os.getenv("OPENAI_API_KEY", "")
        )

        model = str(
            provider_config.get("model")
            or os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
        )

        url = (
            "wss://api.openai.com/v1/realtime"
            f"?model={model}"
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
        }

        session_update = {}

        return RealtimeProviderConnection(
            url=url,
            headers=headers,
            session_update=session_update,
        )

    def build_session_update(self, provider_config: dict[str, object], voice_rate: str, instructions: str) -> dict[str, object]:
        selected_voice = str(provider_config.get("voice") or "alloy").strip() or "alloy"

        return {
            "type": "session.update",
            "session": {
                "type": "realtime",
                "output_modalities": ["audio"],
                "audio": {
                    "input": {
                        "format": {
                            "type": "audio/pcm",
                            "rate": 24000,
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.6,
                            "prefix_padding_ms": 500,
                            "silence_duration_ms": 1500,
                            "create_response": True,
                            "interrupt_response": True,
                        },
                    },
                    "output": {
                        "format": {
                            "type": "audio/pcm",
                            "rate": 24000,
                        },
                        "voice": selected_voice,
                        "speed": float(voice_rate),
                    },
                },
                "instructions": instructions,
            },
        }

    async def test_connection(self, provider_config: dict[str, object]) -> dict[str, object]:
        connection = self.build_connection(provider_config)

        if not connection.url:
            return {
                "ok": False,
                "message": "OpenAI Realtime URL is missing.",
            }

        authorization = connection.headers.get("Authorization", "")
        if not authorization or authorization == "Bearer ":
            return {
                "ok": False,
                "message": "OpenAI API key is missing.",
            }

        return await probe_realtime_websocket(
            provider_id=self.provider_id,
            provider_label="OpenAI",
            url=connection.url,
            headers=connection.headers,
        )
