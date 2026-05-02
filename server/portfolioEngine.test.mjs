import { describe, expect, it } from "vitest";
import { buildPortfolioSnapshot } from "./portfolioEngine.mjs";
import { loadPortfolioSource } from "./portfolioSource.mjs";

describe("local portfolio source and snapshot", () => {
  it("keeps an explicitly empty manual portfolio empty", async () => {
    const snapshot = await buildPortfolioSnapshot({
      positions: [],
      getCoinPrices: async (ids) => {
        expect(ids).toEqual([]);
        return [];
      }
    });

    expect(snapshot.portfolioSource.provider).toBe("manual_runtime");
    expect(snapshot.portfolioSource.assetCount).toBe(0);
    expect(snapshot.assets).toEqual([]);
    expect(snapshot.marketData.status).toBe("fallback");
    expect(Number.isFinite(snapshot.risk.currentRiskScore)).toBe(true);
    expect(Number.isFinite(snapshot.risk.optimizedRiskScore)).toBe(true);
  });

  it("filters invalid manual positions before pricing", () => {
    const source = loadPortfolioSource([
      { symbol: "BTC", coinGeckoId: "bitcoin", name: "Bitcoin", amount: 1 },
      { symbol: "ETH", coinGeckoId: "ethereum", name: "Ethereum", amount: 0 },
      { symbol: "SOL", coinGeckoId: "", name: "Solana", amount: 3 }
    ]);

    expect(source.positions).toEqual([{ symbol: "BTC", coinGeckoId: "bitcoin", name: "Bitcoin", amount: 1 }]);
  });
});
