export interface MarketPrice {
  id: string;
  priceUsd: number | null;
  dailyChangePct: number | null;
  marketCapUsd: number | null;
  lastUpdatedAt: string | null;
  source: "coingecko" | "coingecko-cache" | "fallback";
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
  priceUsd: number | null;
  dailyChangePct: number | null;
  image?: string;
  source: "coingecko";
}

export interface MarketDataProvider {
  getPrices(ids: string[]): Promise<MarketPrice[]>;
  searchCoins(query: string): Promise<CoinSearchResult[]>;
}
