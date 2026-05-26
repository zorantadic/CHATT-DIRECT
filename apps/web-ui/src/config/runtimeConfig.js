const runtimeConfig = {
  realtimeHttp: import.meta.env.VITE_REALTIME_HTTP || "http://127.0.0.1:50505",
  realtimeWs: import.meta.env.VITE_REALTIME_WS || "ws://127.0.0.1:50505/voice/ws",
};

export default runtimeConfig;
