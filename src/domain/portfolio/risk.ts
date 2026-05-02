import type { PortfolioAsset, RebalanceAction, RebalanceRecommendation } from "./types";

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const calculatePositionValue = (amount: number, priceUsd: number): number => amount * priceUsd;

export const calculateTotalValue = (assets: Pick<PortfolioAsset, "amount" | "priceUsd">[]): number =>
  assets.reduce((sum, asset) => sum + calculatePositionValue(asset.amount, asset.priceUsd), 0);

export const calculateWeights = <T extends Pick<PortfolioAsset, "amount" | "priceUsd">>(
  assets: T[]
): Array<T & { currentWeightPct: number }> => {
  const totalValue = calculateTotalValue(assets);

  return assets.map((asset) => ({
    ...asset,
    currentWeightPct: totalValue === 0 ? 0 : roundTo((calculatePositionValue(asset.amount, asset.priceUsd) / totalValue) * 100)
  }));
};

/**
 * Computes portfolio volatility from a covariance matrix using the Markowitz w^T Sigma w term.
 * Weights are percentages because the UI and optimizer both communicate allocation in percent units.
 */
export const calculatePortfolioVolatility = (weightsPct: number[], covarianceMatrix: number[][]): number => {
  if (weightsPct.length !== covarianceMatrix.length) {
    throw new Error("Weights and covariance matrix dimensions must match.");
  }

  const weights = weightsPct.map((weight) => weight / 100);
  const variance = weights.reduce((rowSum, rowWeight, rowIndex) => {
    const weightedCovariance = weights.reduce((columnSum, columnWeight, columnIndex) => {
      return columnSum + rowWeight * covarianceMatrix[rowIndex][columnIndex] * columnWeight;
    }, 0);

    return rowSum + weightedCovariance;
  }, 0);

  return roundTo(Math.sqrt(Math.max(variance, 0)) * 100);
};

/**
 * Converts volatility and concentration into a bounded institutional risk score.
 * Higher values indicate higher drawdown risk and more concentrated exposure.
 */
export const calculateRiskScore = (params: {
  volatilityPct: number;
  maxPositionWeightPct: number;
  drawdownProbabilityPct: number;
}): number => {
  const volatilityComponent = params.volatilityPct * 1.15;
  const concentrationComponent = Math.max(params.maxPositionWeightPct - 25, 0) * 0.85;
  const drawdownComponent = params.drawdownProbabilityPct * 0.55;

  return Math.round(clamp(volatilityComponent + concentrationComponent + drawdownComponent, 0, 100));
};

/**
 * Estimates a 30-day drawdown probability from the local risk model.
 */
export const estimateDrawdownProbability = (volatilityPct: number, marketStressMultiplier: number): number => {
  const normalizedVolatility = volatilityPct / 100;
  const logistic = 1 / (1 + Math.exp(-10 * (normalizedVolatility - 0.28)));
  return roundTo(clamp(logistic * 100 * marketStressMultiplier, 0, 99));
};

export const getRebalanceAction = (deltaPct: number): RebalanceAction => {
  if (deltaPct > 0.5) {
    return "increase";
  }

  if (deltaPct < -0.5) {
    return "reduce";
  }

  return "hold";
};

export const buildRebalanceRecommendations = (
  assets: Pick<PortfolioAsset, "symbol" | "currentWeightPct" | "targetWeightPct" | "covarianceCluster">[]
): RebalanceRecommendation[] =>
  assets.map((asset) => {
    const deltaPct = roundTo(asset.targetWeightPct - asset.currentWeightPct);
    const action = getRebalanceAction(deltaPct);

    return {
      symbol: asset.symbol,
      currentWeightPct: asset.currentWeightPct,
      targetWeightPct: asset.targetWeightPct,
      deltaPct,
      action,
      rationale:
        action === "hold"
          ? "Отклонение находится внутри допуска модели."
          : `Сегмент ${asset.covarianceCluster}: модель снижает ковариационную нагрузку портфеля.`
    };
  });
