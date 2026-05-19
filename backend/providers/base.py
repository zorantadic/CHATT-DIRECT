from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RealtimeProviderConnection:
    url: str
    headers: dict[str, str]
    session_update: dict[str, Any]


class RealtimeProviderAdapter:
    provider_id: str

    def build_connection(self, provider_config: dict[str, Any]) -> RealtimeProviderConnection:
        raise NotImplementedError

    def build_session_update(self, voice_rate: str, instructions: str) -> dict[str, Any]:
        raise NotImplementedError