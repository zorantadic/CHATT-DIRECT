import os

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
    probe_realtime_websocket,
)


class XAIGrokRealtimeAdapter(RealtimeProviderAdapter):
    provider_id = "xai-grok-realtime"

    def build_connection(self, provider_config: dict[str, str]) -> RealtimeProviderConnection:
        api_key = str(
            provider_config.get("apiKey")
            or os.getenv("XAI_API_KEY", "")
        )

        model = str(
            provider_config.get("model")
            or os.getenv("XAI_GROK_REALTIME_MODEL", "grok-voice-think-fast-1.0")
        )

        url = f"wss://api.x.ai/v1/realtime?model={model}"

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
        selected_voice = str(provider_config.get("voice") or "eve").strip() or "eve"
        normalized_rate = str(voice_rate or "1").strip() or "1"
        base_instructions = (instructions or "").strip()
        pacing_rule = ""

        if normalized_rate == "0.9":
            pacing_rule = (
                "VOICE PACING RULE:\n"
                "Speak slightly slower than normal while keeping a natural conversational pace."
            )
        elif normalized_rate == "0.8":
            pacing_rule = (
                "VOICE PACING RULE:\n"
                "Speak slowly and clearly. Use a calm pace and add short pauses between sentences."
            )

        final_instructions = base_instructions
        if pacing_rule:
            final_instructions = f"{base_instructions}\n\n{pacing_rule}" if base_instructions else pacing_rule

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
                    },
                },
                "instructions": final_instructions,
            },
        }

    async def test_connection(self, provider_config: dict[str, object]) -> dict[str, object]:
        connection = self.build_connection(provider_config)

        if not connection.url:
            return {
                "ok": False,
                "message": "xAI Grok Realtime URL is missing.",
            }

        authorization = connection.headers.get("Authorization", "")
        if not authorization or authorization == "Bearer ":
            return {
                "ok": False,
                "message": "xAI API key is missing.",
            }

        return await probe_realtime_websocket(
            provider_id=self.provider_id,
            provider_label="xAI Grok",
            url=connection.url,
            headers=connection.headers,
        )
