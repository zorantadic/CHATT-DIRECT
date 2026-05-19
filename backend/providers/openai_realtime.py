import os

from .base import (
    RealtimeProviderAdapter,
    RealtimeProviderConnection,
)


class OpenAIRealtimeAdapter(RealtimeProviderAdapter):
    provider_id = "openai-realtime"

    def build_connection(self) -> RealtimeProviderConnection:
        api_key = os.getenv("OPENAI_API_KEY", "")
        model = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2")

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
    