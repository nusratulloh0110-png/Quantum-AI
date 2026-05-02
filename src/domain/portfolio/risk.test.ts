import { describe, expect, it } from "vitest";
import {
  buildRebalanceRecommendations,
  calculatePortfolioVolatility,
  calculateTotalValue,
  calculateWeights,
  estimateDrawdownProbability,
  getRebalanceAction
} from "./risk";

describe("portfolio risk calculations", () => {
  it("calculates total notional value", () => {
    expect(calculateTotalValue([{ amount: 2, priceUsd: 100 }, { amount: 5, priceUsd: 20 }])).toBe(300);
  });

  it("calculates allocation weights from notional values", () => {
    const weighted = calculateWeights([{ amount: 1, priceUsd: 80 }, { amount: 1, priceUsd: 20 }]);

    expect(weighted[0].currentWeightPct).toBe(80);
    expect(weighted[1].currentWeightPct).toBe(20);
  });

  it("calculates Markowitz volatility from covariance matrix", () => {
    const volatility = calculatePortfolioVolatility(
      [60, 40],
      [
        [0.04, 0.01],
        [0.01, 0.09]
      ]
    );

    expect(volatility).toBe(18.33);
  });

  it("classifies rebalance actions using tolerance band", () => {
    expect(getRebalanceAction(1.2)).toBe("increase");
    expect(getRebalanceAction(-1.2)).toBe("reduce");
    expect(getRebalanceAction(0.3)).toBe("hold");
  });

  it("builds recommendations with signed deltas", () => {
    const recommendations = buildRebalanceRecommendations([
      { symbol: "BTC", currentWeightPct: 34, targetWeightPct: 27, covarianceCluster: "Core" },
      { symbol: "USDC", currentWeightPct: 21, targetWeightPct: 22, covarianceCluster: "Liquidity" }
    ]);

    expect(recommendations[0]).toMatchObject({ symbol: "BTC", deltaPct: -7, action: "reduce" });
    expect(recommendations[1]).toMatchObject({ symbol: "USDC", deltaPct: 1, action: "increase" });
  });

  it("keeps drawdown probability bounded", () => {
    expect(estimateDrawdownProbability(5, 1)).toBeGreaterThanOrEqual(0);
    expect(estimateDrawdownProbability(120, 2)).toBeLessThanOrEqual(99);
  });
});
