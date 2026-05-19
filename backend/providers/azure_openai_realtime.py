import os

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
)


class AzureOpenAIRealtimeAdapter(RealtimeProviderAdapter):
    provider_id = "azure-openai-realtime"

    def build_connection(self) -> RealtimeProviderConnection:
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
        api_key = os.getenv("AZURE_OPENAI_KEY", "")
        model = os.getenv("AZURE_OPENAI_MODEL", "gpt-realtime-mini")
        api_version = os.getenv(
            "AZURE_OPENAI_API_VERSION",
            "2025-05-01-preview",
        )
        profile = os.getenv(
            "AZURE_OPENAI_PROFILE",
            "byom-azure-openai-realtime",
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