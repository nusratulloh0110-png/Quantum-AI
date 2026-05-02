/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_BUILD_VERSION: string;
  readonly VITE_MARKET_DATA_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
