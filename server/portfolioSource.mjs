import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const emptyPositions = [];

const normalizePosition = (position) => ({
  symbol: String(position.symbol ?? "").trim().toUpperCase(),
  coinGeckoId: String(position.coinGeckoId ?? position.id ?? "").trim(),
  name: String(position.name ?? position.symbol ?? "").trim(),
  amount: Number(position.amount ?? 0)
});

const isValidPosition = (position) =>
  position.symbol && position.coinGeckoId && Number.isFinite(position.amount) && position.amount > 0;

const normalizePositions = (positions) => (Array.isArray(positions) ? positions : []).map(normalizePosition).filter(isValidPosition);

export const loadPortfolioSource = (manualPositions) => {
  if (Array.isArray(manualPositions)) {
    const positions = normalizePositions(manualPositions);

    return {
      provider: "manual_runtime",
      status: positions.length > 0 ? "connected" : "fallback",
      description:
        positions.length > 0
          ? "Manual portfolio input. Exchange and wallet connectors can be added later."
          : "Manual portfolio input is empty.",
      positions
    };
  }

  const inlineJson = process.env.PORTFOLIO_HOLDINGS_JSON;

  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson);
      const positions = normalizePositions(parsed.positions ?? parsed);

      return {
        provider: "manual_runtime",
        status: positions.length > 0 ? "connected" : "fallback",
        description: "Loaded from PORTFOLIO_HOLDINGS_JSON",
        positions
      };
    } catch {
      return {
        provider: "manual_runtime",
        status: "fallback",
        description: "PORTFOLIO_HOLDINGS_JSON is invalid. No portfolio positions are active.",
        positions: emptyPositions
      };
    }
  }

  const filePath = resolve(process.cwd(), process.env.PORTFOLIO_HOLDINGS_FILE ?? "data/portfolio.holdings.json");

  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      const positions = normalizePositions(parsed.positions ?? []);

      return {
        provider: "local_file",
        status: positions.length > 0 ? "connected" : "fallback",
        description: parsed.accountLabel ? `Loaded from ${parsed.accountLabel}` : `Loaded from ${filePath}`,
        positions
      };
    } catch {
      return {
        provider: "local_file",
        status: "fallback",
        description: `Portfolio source file is invalid: ${filePath}. No portfolio positions are active.`,
        positions: emptyPositions
      };
    }
  }

  return {
    provider: "local_file",
    status: "fallback",
    description: "Portfolio source file is missing. No portfolio positions are active.",
    positions: emptyPositions
  };
};
