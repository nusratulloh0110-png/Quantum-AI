const nowIso = () => new Date().toISOString();

const normalizePosition = (position) => ({
  symbol: String(position?.symbol ?? "").trim().toUpperCase(),
  coinGeckoId: String(position?.coinGeckoId ?? position?.coin_gecko_id ?? position?.id ?? "").trim(),
  name: String(position?.name ?? position?.symbol ?? "").trim(),
  amount: Number(position?.amount ?? 0)
});

const isValidPosition = (position) =>
  position.symbol && position.coinGeckoId && Number.isFinite(position.amount) && position.amount > 0;

export const normalizePortfolioPositions = (positions) =>
  (Array.isArray(positions) ? positions : []).map(normalizePosition).filter(isValidPosition);

const mapPositionRow = (row) => ({
  symbol: row.symbol,
  coinGeckoId: row.coin_gecko_id,
  name: row.name,
  amount: Number(row.amount)
});

export const createPortfolioStore = ({ db }) => {
  if (!db) {
    throw new Error("Portfolio store requires a database instance.");
  }

  return {
    async listPositions(userId) {
      const result = await db.query(
        `SELECT symbol, coin_gecko_id, name, amount
         FROM portfolio_positions
         WHERE user_id = $1
         ORDER BY position_order ASC, id ASC`,
        [userId]
      );

      return result.rows.map(mapPositionRow);
    },
    async replacePositions(userId, positions) {
      const cleaned = normalizePortfolioPositions(positions);
      const timestamp = nowIso();

      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM portfolio_positions WHERE user_id = $1", [userId]);

        for (const [index, position] of cleaned.entries()) {
          await tx.query(
            `INSERT INTO portfolio_positions (
              user_id, symbol, coin_gecko_id, name, amount, position_order, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId,
              position.symbol,
              position.coinGeckoId,
              position.name || position.symbol,
              position.amount,
              index,
              timestamp,
              timestamp
            ]
          );
        }
      });

      return cleaned;
    }
  };
};
