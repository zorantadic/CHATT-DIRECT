import os

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
    probe_realtime_websocket,
)


class AzureOpenAIRealtimeAdapter(RealtimeProviderAdapter):
    provider_id = "azure-openai-realtime"

    def build_connection(self, provider_config: dict[str, str]) -> RealtimeProviderConnection:
        endpoint = str(
            provider_config.get("endpoint")
            or os.getenv("AZURE_OPENAI_ENDPOINT", "")
        ).rstrip("/")

        api_key = str(
            provider_config.get("apiKey")
            or os.getenv("AZURE_OPENAI_KEY", "")
        )

        model = str(
            provider_config.get("model")
            or os.getenv("AZURE_OPENAI_MODEL", "gpt-realtime-1.5")
        )

        api_version = str(
            provider_config.get("apiVersion")
            or os.getenv("AZURE_OPENAI_API_VERSION", "2025-05-01-preview")
        )

        profile = str(
            provider_config.get("profile")
            or os.getenv("AZURE_OPENAI_PROFILE", "byom-azure-openai-realtime")
        )

        host = (
            endpoint.replace("https://", "")
            .replace("http://", "")
            .strip("/")
        )

        url = (
            f"wss://{host}/voice-agent/realtime"
            f"?api-version={api_version}"
            f"&model={model}"
            f"&profile={profile}"
        )

        headers = {
            "api-key": api_key,
        }

        session_update = {}

        return RealtimeProviderConnection(
            url=url,
            headers=headers,
            session_update=session_update,
        )

    def build_session_update(self, voice_rate: str, instructions: str) -> dict[str, object]:
        return {
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
                "instructions": instructions,
            },
        }

    async def test_connection(self, provider_config: dict[str, object]) -> dict[str, object]:
        connection = self.build_connection(provider_config)

        if not connection.url:
            return {
                "ok": False,
                "message": "Azure OpenAI Realtime URL is missing.",
            }

        api_key = connection.headers.get("api-key", "")
        if not api_key:
            return {
                "ok": False,
                "message": "Azure OpenAI API key is missing.",
            }

        return await probe_realtime_websocket(
            provider_id=self.provider_id,
            provider_label="Azure OpenAI",
            url=connection.url,
            headers=connection.headers,
        )
