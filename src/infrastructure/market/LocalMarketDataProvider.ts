import type { CoinSearchResult, MarketDataProvider, MarketPrice } from "../../domain/market/types";
import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { ...init, credentials: "include", signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Local API returned ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export class LocalMarketDataProvider implements MarketDataProvider {
  async getPrices(ids: string[]): Promise<MarketPrice[]> {
    if (!ids.length) {
      return [];
    }

    const data = await fetchJson<{ prices: MarketPrice[] }>(buildLocalApiUrl("/market/prices", { ids: ids.join(","), vs: "usd" }));
    return data.prices;
  }

  async searchCoins(query: string): Promise<CoinSearchResult[]> {
    const data = await fetchJson<{ coins: CoinSearchResult[] }>(buildLocalApiUrl("/market/search", { query }));
    return data.coins;
  }
}
