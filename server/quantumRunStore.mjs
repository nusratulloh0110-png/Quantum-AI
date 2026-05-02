import { createHash } from "node:crypto";

const nowIso = () => new Date().toISOString();

export const buildPortfolioHash = (assets) => {
  const normalizedAssets = (Array.isArray(assets) ? assets : [])
    .map((asset) => ({
      symbol: String(asset?.symbol ?? "").trim().toUpperCase(),
      coinGeckoId: String(asset?.coinGeckoId ?? "").trim(),
      amount: Number(asset?.amount ?? 0)
    }))
    .filter((asset) => asset.symbol && asset.coinGeckoId && Number.isFinite(asset.amount) && asset.amount > 0)
    .sort((a, b) => `${a.symbol}:${a.coinGeckoId}`.localeCompare(`${b.symbol}:${b.coinGeckoId}`));

  return createHash("sha256").update(JSON.stringify(normalizedAssets)).digest("hex");
};

export const createQuantumRunStore = ({ db }) => {
  if (!db) {
    throw new Error("Quantum run store requires a database instance.");
  }

  return {
    async getLatestRun(userId, assets) {
      const portfolioHash = buildPortfolioHash(assets);
      const result = await db.query(
        `SELECT result_json
         FROM quantum_runs
         WHERE user_id = $1 AND portfolio_hash = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, portfolioHash]
      );

      return result.rows[0]?.result_json ?? null;
    },
    async saveRun(userId, assets, result) {
      const portfolioHash = buildPortfolioHash(assets);
      const timestamp = nowIso();

      await db.query(
        `INSERT INTO quantum_runs (user_id, portfolio_hash, assets_json, result_json, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, portfolioHash, JSON.stringify(assets), JSON.stringify(result), timestamp]
      );

      return result;
    }
  };
};
