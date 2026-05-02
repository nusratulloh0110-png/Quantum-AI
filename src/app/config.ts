export const appConfig = {
  appEnv: import.meta.env.VITE_APP_ENV ?? "local",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  buildVersion: import.meta.env.VITE_BUILD_VERSION ?? "QWG-product-local",
  marketDataMode: import.meta.env.VITE_MARKET_DATA_MODE ?? "live"
} as const;
