export type AssetSymbol = string;

export type QuantumTaskStatus = "pending" | "computing" | "completed" | "failed";

export type RebalanceAction = "increase" | "reduce" | "hold";

export interface PortfolioAsset {
  symbol: AssetSymbol;
  coinGeckoId: string;
  name: string;
  amount: number;
  priceUsd: number;
  dailyChangePct: number;
  currentWeightPct: number;
  targetWeightPct: number;
  volatilityPct: number;
  covarianceCluster: "Core" | "L1" | "Liquidity" | "Oracle";
  marketDataSource: "coingecko" | "coingecko-cache" | "fallback";
}

export interface RiskProfile {
  riskToleranceScore: number;
  currentRiskScore: number;
  optimizedRiskScore: number;
  drawdownProbabilityPct: number;
  optimizedDrawdownProbabilityPct: number;
  valueAtRiskPct: number;
  targetVolatilityPct: number;
  sharpeRatio: number;
}

export interface QuantumTask {
  id: string;
  status: QuantumTaskStatus;
  engine: "QAOA";
  device: string;
  library: string;
  qubits: number;
  shots: number;
  depth: number;
  progressPct: number;
  energy: number;
  beta: number;
  gamma: number;
  bestBitstring: string;
  resultWeights: Record<string, number>;
  startedAt: string;
  completedAt: string;
  distribution?: QuantumDistributionPoint[];
  iterations?: QuantumIteration[];
  assetResults?: QuantumAssetResult[];
  explanation?: QuantumExplanation;
}

export interface QuantumDistributionPoint {
  bitstring: string;
  probability: number;
  energy: number;
  selectedSymbols: string[];
}

export interface QuantumIteration {
  step: number;
  beta: number;
  gamma: number;
  energy: number;
}

export interface QuantumAssetResult {
  symbol: AssetSymbol;
  currentWeightPct: number;
  targetWeightPct: number;
  deltaPct: number;
  selected: boolean;
  volatilityPct: number;
}

export interface QuantumExplanation {
  input: string;
  qubo: string;
  qaoa: string;
  output: string;
}

export interface CorrelationCell {
  x: AssetSymbol;
  y: AssetSymbol;
  value: number;
}

export interface FrontierPoint {
  volatilityPct: number;
  expectedReturnPct: number;
  label: string;
}

export interface InsightLogEntry {
  level: "SYSTEM" | "DATA" | "QUANTUM" | "LOCAL" | "INFO" | "RESULT" | "WARN";
  timestamp: string;
  message: string;
}

export interface RebalanceRecommendation {
  symbol: AssetSymbol;
  currentWeightPct: number;
  targetWeightPct: number;
  deltaPct: number;
  action: RebalanceAction;
  rationale: string;
}

export interface MarketStressSignal {
  name: string;
  value: string;
  severity: "low" | "medium" | "high";
}

export interface AdvisorMessage {
  id: string;
  role: "system" | "user";
  content: string;
  createdAt: string;
  sourceLabel?: string;
}

export interface PortfolioSourceStatus {
  provider: "local_file" | "binance" | "manual_runtime";
  status: "connected" | "fallback";
  assetCount: number;
  description: string;
}

export interface ManualPortfolioPosition {
  symbol: string;
  coinGeckoId: string;
  name: string;
  amount: number;
}

export interface MarketDataStatus {
  provider: "CoinGecko";
  status: "live" | "partial" | "fallback";
  livePriceCount: number;
  totalAssetCount: number;
  lastUpdatedAt: string | null;
  error?: string;
}

export interface PortfolioSnapshot {
  totalValueUsd: number;
  updatedAt: string;
  portfolioSource: PortfolioSourceStatus;
  marketData: MarketDataStatus;
  assets: PortfolioAsset[];
  risk: RiskProfile;
  quantumTask: QuantumTask;
  correlationMatrix: CorrelationCell[];
  frontier: FrontierPoint[];
  insightLog: InsightLogEntry[];
  recommendations: RebalanceRecommendation[];
  stressSignals: MarketStressSignal[];
  advisorMessages: AdvisorMessage[];
}

export interface PortfolioRepository {
  getPositions(): Promise<ManualPortfolioPosition[]>;
  savePositions(positions: ManualPortfolioPosition[]): Promise<ManualPortfolioPosition[]>;
  getSnapshot(): Promise<PortfolioSnapshot>;
}
