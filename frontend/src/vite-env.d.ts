/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_HTTP: string;
  readonly VITE_REALTIME_WS: string;

  readonly VITE_ORCH_HTTP: string;
  readonly VITE_ORCH_CONTROL_WS: string;

  readonly VITE_STT_WS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
