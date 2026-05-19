from .azure_openai_realtime import AzureOpenAIRealtimeAdapter
from .base import RealtimeProviderAdapter
from .openai_realtime import OpenAIRealtimeAdapter


def get_realtime_provider_adapter(provider_id: str) -> RealtimeProviderAdapter:
    if provider_id == "azure-openai-realtime":
        return AzureOpenAIRealtimeAdapter()

    if provider_id == "openai-realtime":
        return OpenAIRealtimeAdapter()

    raise ValueError(f"Unsupported realtime provider: {provider_id}")