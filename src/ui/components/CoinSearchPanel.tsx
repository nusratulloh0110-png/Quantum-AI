import { FormEvent, useEffect, useState } from "react";
import type { CoinSearchResult, MarketDataProvider } from "../../domain/market/types";
import { formatCurrencyPrecise, formatPct } from "../formatters";
import { Badge } from "./Badge";
import { TerminalIcon } from "./TerminalIcon";

interface CoinSearchPanelProps {
  marketDataProvider: MarketDataProvider;
}

export const CoinSearchPanel = ({ marketDataProvider }: CoinSearchPanelProps) => {
  const [query, setQuery] = useState("");
  const [coins, setCoins] = useState<CoinSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCoins = async (nextQuery: string) => {
    setIsLoading(true);

    try {
      const results = await marketDataProvider.searchCoins(nextQuery);
      setCoins(results);
    } catch {
      setCoins([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCoins("");
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadCoins(query.trim());
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Asset Universe</h2>
        <Badge tone="navy">CoinGecko</Badge>
      </div>

      <form className="mb-3 flex gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="coin-search">
          Search asset
        </label>
        <input
          id="coin-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="bitcoin, solana, kaspa..."
          className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy"
        />
        <button className="icon-button" type="submit" title="Search asset" aria-label="Search asset">
          <TerminalIcon name="search" size={17} />
        </button>
      </form>

      <div className="asset-universe-list">
        {isLoading ? (
          <div className="skeleton-row" />
        ) : coins.length === 0 ? (
          <div className="empty-state">No market data returned by the local API.</div>
        ) : (
          coins.map((coin) => (
            <div key={coin.id} className="asset-universe-row">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-950">{coin.name}</span>
                  <span className="font-mono text-xs text-slate-500">{coin.symbol}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  {coin.marketCapRank ? `Rank #${coin.marketCapRank}` : coin.id}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-slate-950">
                  {typeof coin.priceUsd === "number" ? formatCurrencyPrecise(coin.priceUsd) : "n/a"}
                </div>
                <div
                  className={`mt-1 font-mono text-[11px] ${
                    (coin.dailyChangePct ?? 0) < 0 ? "text-crimson" : "text-emeraldStrict"
                  }`}
                >
                  {typeof coin.dailyChangePct === "number" ? formatPct(coin.dailyChangePct) : "n/a"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
