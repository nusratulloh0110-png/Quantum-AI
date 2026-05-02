import type { MarketDataProvider } from "../../domain/market/types";
import type { Language } from "../i18n";
import { CoinSearchPanel } from "../components/CoinSearchPanel";

interface AssetUniverseProps {
  marketDataProvider: MarketDataProvider;
  language: Language;
}

export const AssetUniverse = ({ marketDataProvider, language }: AssetUniverseProps) => (
  <div className="view-stack">
    <section className="panel">
      <div className="panel-header">
        <h2>{language === "ru" ? "Поиск активов" : "Asset Universe"}</h2>
        <span>{language === "ru" ? "CoinGecko market-data" : "CoinGecko market data"}</span>
      </div>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-600">
        {language === "ru"
          ? "Найдите монету, посмотрите CoinGecko ID, цену, капитализацию и 24h-изменение. Этот экран вынесен отдельно, чтобы портфель не растягивался вниз."
          : "Search coins, inspect CoinGecko IDs, prices, rank and 24h change. This is separate from the portfolio dashboard so the dashboard stays compact."}
      </p>
    </section>
    <CoinSearchPanel marketDataProvider={marketDataProvider} />
  </div>
);
