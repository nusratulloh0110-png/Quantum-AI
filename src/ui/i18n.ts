export type Language = "ru" | "en";

export const uiText = {
  ru: {
    dashboard: "Портфель",
    quantum: "Квантовый расчет",
    execution: "Исполнение",
    setup: "Активы",
    universe: "Рынок",
    guide: "Продукт",
    terminalSubtitle: "Рабочий риск-терминал",
    loading: "Загрузка цен и портфеля",
    localServices: "Локальные сервисы активны",
    prices: "Цены",
    lastMarketSync: "Обновление",
    providerTick: "тик провайдера",
    localQaoa: "QAOA engine",
    groqProxy: "AI analytics",
    refresh: "Обновить",
    syncing: "Синхронизация",
    productStatus: "Рабочий продукт"
  },
  en: {
    dashboard: "Portfolio",
    quantum: "Quantum Run",
    execution: "Execution",
    setup: "Assets",
    universe: "Market",
    guide: "Product",
    terminalSubtitle: "Working risk terminal",
    loading: "Loading prices and portfolio",
    localServices: "Local services active",
    prices: "Prices",
    lastMarketSync: "Last market sync",
    providerTick: "provider tick",
    localQaoa: "QAOA engine",
    groqProxy: "AI analytics",
    refresh: "Refresh",
    syncing: "Syncing",
    productStatus: "Live product"
  }
} as const;
