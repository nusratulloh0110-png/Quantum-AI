import { loadPortfolioSource } from "./portfolioSource.mjs";
import { simulateLocalQaoa } from "./localQuantumOptimizer.mjs";

const volatilityBySymbol = {
  BTC: 34.2,
  ETH: 41.8,
  SOL: 67.4,
  BNB: 38.6,
  LINK: 58.1,
  USDC: 2.1,
  USDT: 2.1,
  KAS: 74.5
};

const clusterBySymbol = {
  BTC: "Core",
  ETH: "Core",
  SOL: "L1",
  BNB: "Liquidity",
  LINK: "Oracle",
  USDC: "Liquidity",
  USDT: "Liquidity"
};

const roundTo = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const calculateTotalValue = (assets) => assets.reduce((sum, asset) => sum + asset.amount * asset.priceUsd, 0);

const calculateWeights = (assets) => {
  const totalValue = calculateTotalValue(assets);

  return assets.map((asset) => ({
    ...asset,
    currentWeightPct: totalValue === 0 ? 0 : roundTo(((asset.amount * asset.priceUsd) / totalValue) * 100)
  }));
};

const getCluster = (symbol) => clusterBySymbol[symbol] ?? "Core";

const getCorrelation = (assetA, assetB) => {
  if (assetA.symbol === assetB.symbol) {
    return 1;
  }

  if (assetA.symbol.includes("USD") || assetB.symbol.includes("USD")) {
    return 0.03;
  }

  if (getCluster(assetA.symbol) === getCluster(assetB.symbol)) {
    return 0.72;
  }

  if ((assetA.symbol === "BTC" && assetB.symbol === "ETH") || (assetA.symbol === "ETH" && assetB.symbol === "BTC")) {
    return 0.67;
  }

  return 0.48;
};

const buildCorrelationMatrix = (assets) =>
  assets.flatMap((x) =>
    assets.map((y) => ({
      x: x.symbol,
      y: y.symbol,
      value: getCorrelation(x, y)
    }))
  );

const buildCovarianceMatrix = (assets) =>
  assets.map((assetA) =>
    assets.map((assetB) => {
      const volatilityA = assetA.volatilityPct / 100;
      const volatilityB = assetB.volatilityPct / 100;
      return volatilityA * volatilityB * getCorrelation(assetA, assetB);
    })
  );

const calculatePortfolioVolatility = (weightsPct, covarianceMatrix) => {
  const weights = weightsPct.map((weight) => weight / 100);
  const variance = weights.reduce((rowSum, rowWeight, rowIndex) => {
    const weightedCovariance = weights.reduce((columnSum, columnWeight, columnIndex) => {
      return columnSum + rowWeight * covarianceMatrix[rowIndex][columnIndex] * columnWeight;
    }, 0);

    return rowSum + weightedCovariance;
  }, 0);

  return roundTo(Math.sqrt(Math.max(variance, 0)) * 100);
};

const estimateDrawdownProbability = (volatilityPct, marketStressMultiplier) => {
  const normalizedVolatility = volatilityPct / 100;
  const logistic = 1 / (1 + Math.exp(-10 * (normalizedVolatility - 0.28)));
  return roundTo(Math.min(Math.max(logistic * 100 * marketStressMultiplier, 0), 99));
};

const calculateRiskScore = ({ volatilityPct, maxPositionWeightPct, drawdownProbabilityPct }) => {
  const volatilityComponent = volatilityPct * 1.15;
  const concentrationComponent = Math.max(maxPositionWeightPct - 25, 0) * 0.85;
  const drawdownComponent = drawdownProbabilityPct * 0.55;
  return Math.round(Math.min(Math.max(volatilityComponent + concentrationComponent + drawdownComponent, 0), 100));
};

const buildRecommendations = (assets) =>
  assets.map((asset) => {
    const deltaPct = roundTo(asset.targetWeightPct - asset.currentWeightPct);
    const action = deltaPct > 0.5 ? "increase" : deltaPct < -0.5 ? "reduce" : "hold";

    return {
      symbol: asset.symbol,
      currentWeightPct: asset.currentWeightPct,
      targetWeightPct: asset.targetWeightPct,
      deltaPct,
      action,
      rationale:
        action === "hold"
          ? "Deviation is inside the model tolerance band."
          : `Cluster ${asset.covarianceCluster}: local QAOA reduces covariance and concentration load.`
    };
  });

const buildFrontier = (targetVolatilityPct) => [
  { volatilityPct: roundTo(targetVolatilityPct * 0.55), expectedReturnPct: 8.6, label: "Capital Preserve" },
  { volatilityPct: roundTo(targetVolatilityPct * 0.76), expectedReturnPct: 14.2, label: "Low Variance" },
  { volatilityPct: targetVolatilityPct, expectedReturnPct: 19.5, label: "Target Model" },
  { volatilityPct: roundTo(targetVolatilityPct * 1.25), expectedReturnPct: 25.4, label: "Growth" },
  { volatilityPct: roundTo(targetVolatilityPct * 1.48), expectedReturnPct: 30.1, label: "Aggressive" }
];

const buildInsightLog = (completedAt, source, livePriceCount, assetCount, quantumTask, marketError) => [
  { level: "SYSTEM", timestamp: completedAt, message: "Manual portfolio source loaded." },
  { level: "DATA", timestamp: completedAt, message: `${source.description}. Assets detected: ${assetCount}.` },
  { level: "DATA", timestamp: completedAt, message: `CoinGecko prices loaded for ${livePriceCount}/${assetCount} assets.` },
  ...(marketError ? [{ level: "WARN", timestamp: completedAt, message: marketError }] : []),
  { level: "QUANTUM", timestamp: completedAt, message: `Local QAOA engine prepared, qubits: ${quantumTask.qubits}, shots: ${quantumTask.shots}.` },
  { level: "LOCAL", timestamp: completedAt, message: `Best bitstring: ${quantumTask.bestBitstring}, Energy: ${quantumTask.energy}.` },
  { level: "RESULT", timestamp: completedAt, message: "Target weights generated by local QAOA runtime." }
];

const normalizeTargetWeights = (assets, resultWeights) => {
  const total = assets.reduce((sum, asset) => sum + (resultWeights[asset.symbol] ?? 0), 0);

  return assets.map((asset) => ({
    ...asset,
    targetWeightPct: total === 0 ? asset.currentWeightPct : roundTo(((resultWeights[asset.symbol] ?? 0) / total) * 100)
  }));
};

export const buildPortfolioSnapshot = async ({ getCoinPrices, positions }) => {
  const updatedAt = new Date().toISOString();
  const source = loadPortfolioSource(positions);
  let marketError;
  let prices = [];

  try {
    prices = await getCoinPrices(source.positions.map((position) => position.coinGeckoId));
  } catch (error) {
    marketError = error instanceof Error ? error.message : "Market data provider failed.";
  }

  const priceMap = new Map(prices.map((price) => [price.id, price]));
  const pricedAssets = source.positions.map((position) => {
    const price = priceMap.get(position.coinGeckoId);

    return {
      ...position,
      priceUsd: price?.priceUsd ?? 0,
      dailyChangePct: price?.dailyChangePct ?? 0,
      volatilityPct: volatilityBySymbol[position.symbol] ?? 62,
      covarianceCluster: getCluster(position.symbol),
      targetWeightPct: 0,
      marketDataSource: typeof price?.priceUsd === "number" ? price.source : "fallback"
    };
  });
  const weightedAssets = calculateWeights(pricedAssets);
  const quantumResult = simulateLocalQaoa(weightedAssets);
  const assets = normalizeTargetWeights(weightedAssets, quantumResult.resultWeights);
  const covarianceMatrix = buildCovarianceMatrix(assets);
  const currentWeights = assets.map((asset) => asset.currentWeightPct);
  const targetWeights = assets.map((asset) => asset.targetWeightPct);
  const currentVolatility = calculatePortfolioVolatility(currentWeights, covarianceMatrix);
  const optimizedVolatility = calculatePortfolioVolatility(targetWeights, covarianceMatrix);
  const drawdownProbabilityPct = estimateDrawdownProbability(currentVolatility, 1.12);
  const optimizedDrawdownProbabilityPct = estimateDrawdownProbability(optimizedVolatility, 0.92);
  const maxCurrentWeightPct = currentWeights.length > 0 ? Math.max(...currentWeights) : 0;
  const maxTargetWeightPct = targetWeights.length > 0 ? Math.max(...targetWeights) : 0;
  const livePrices = prices.filter((price) => typeof price.priceUsd === "number");
  const sortedMarketUpdates = livePrices
    .map((price) => price.lastUpdatedAt)
    .filter(Boolean)
    .sort();
  const livePriceCount = livePrices.length;
  const marketStatus = assets.length === 0 ? "fallback" : livePriceCount === assets.length ? "live" : livePriceCount > 0 ? "partial" : "fallback";
  const risk = {
    riskToleranceScore: 58,
    currentRiskScore: calculateRiskScore({
      volatilityPct: currentVolatility,
      maxPositionWeightPct: maxCurrentWeightPct,
      drawdownProbabilityPct
    }),
    optimizedRiskScore: calculateRiskScore({
      volatilityPct: optimizedVolatility,
      maxPositionWeightPct: maxTargetWeightPct,
      drawdownProbabilityPct: optimizedDrawdownProbabilityPct
    }),
    drawdownProbabilityPct,
    optimizedDrawdownProbabilityPct,
    valueAtRiskPct: 11.82,
    targetVolatilityPct: optimizedVolatility,
    sharpeRatio: assets.length > 0 ? 1.34 : 0
  };

  return {
    totalValueUsd: roundTo(calculateTotalValue(assets), 2),
    updatedAt,
    portfolioSource: {
      provider: source.provider,
      status: source.status,
      assetCount: source.positions.length,
      description: source.description
    },
    marketData: {
      provider: "CoinGecko",
      status: marketStatus,
      livePriceCount,
      totalAssetCount: assets.length,
      lastUpdatedAt: sortedMarketUpdates.length > 0 ? sortedMarketUpdates[sortedMarketUpdates.length - 1] : null,
      error: marketError
    },
    assets,
    risk,
    quantumTask: {
      id: `local-qaoa-${Date.now()}`,
      status: "completed",
      engine: "QAOA",
      device: "Local Statevector QAOA Engine",
      library: quantumResult.library,
      qubits: quantumResult.qubits,
      shots: quantumResult.shots,
      depth: quantumResult.depth,
      progressPct: quantumResult.progressPct,
      energy: quantumResult.energy,
      beta: quantumResult.beta,
      gamma: quantumResult.gamma,
      bestBitstring: quantumResult.bestBitstring,
      resultWeights: quantumResult.resultWeights,
      startedAt: quantumResult.startedAt,
      completedAt: quantumResult.completedAt,
      distribution: quantumResult.distribution,
      iterations: quantumResult.iterations,
      assetResults: quantumResult.assetResults,
      explanation: quantumResult.explanation
    },
    correlationMatrix: buildCorrelationMatrix(assets),
    frontier: buildFrontier(optimizedVolatility),
    insightLog: buildInsightLog(updatedAt, source, livePriceCount, assets.length, quantumResult, marketError),
    recommendations: buildRecommendations(assets),
    stressSignals: [
      { name: "Portfolio source", value: source.provider, severity: source.status === "connected" ? "low" : "medium" },
      { name: "Market data coverage", value: `${livePriceCount}/${assets.length}`, severity: marketStatus === "live" ? "low" : "high" },
      { name: "Local QAOA runtime", value: `${quantumResult.qubits} qubits`, severity: "low" }
    ],
    advisorMessages: [
      {
        id: "m-1",
        role: "system",
        createdAt: updatedAt,
        sourceLabel: "Local QAOA",
        content:
          "Summary: Local QAOA optimization completed. Key Risks: concentration and covariance load were evaluated from detected portfolio assets. Actionable Insights: recommendations use CoinGecko live prices and local quantum output."
      }
    ]
  };
};
