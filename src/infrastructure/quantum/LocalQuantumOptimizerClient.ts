import type { PortfolioAsset, QuantumTask } from "../../domain/portfolio/types";
import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

type RawQuantumDistributionPoint = {
  bitstring?: string;
  probability?: number;
  energy?: number;
  selectedSymbols?: string[];
  asset?: string;
};

type RawQuantumTask = Partial<Omit<QuantumTask, "engine" | "status" | "distribution">> & {
  engine?: string;
  distribution?: RawQuantumDistributionPoint[];
  resultWeights?: Record<string, number>;
};

const toFiniteNumber = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

const buildSelectedSymbols = (bitstring: string, assets: PortfolioAsset[], fallbackAsset?: string): string[] => {
  const selectedSymbols = bitstring
    .split("")
    .map((bit, index) => (bit === "1" ? assets[index]?.symbol : null))
    .filter((symbol): symbol is string => Boolean(symbol));

  return selectedSymbols.length > 0 ? selectedSymbols : fallbackAsset ? [fallbackAsset] : [];
};

const normalizeQuantumTask = (raw: RawQuantumTask, assets: PortfolioAsset[]): QuantumTask => {
  const now = new Date().toISOString();
  const resultWeights = raw.resultWeights ?? {};
  const assetResults =
    raw.assetResults ??
    assets.map((asset) => {
      const targetWeightPct = toFiniteNumber(resultWeights[asset.symbol], asset.targetWeightPct);

      return {
        symbol: asset.symbol,
        currentWeightPct: asset.currentWeightPct,
        targetWeightPct,
        deltaPct: Math.round((targetWeightPct - asset.currentWeightPct) * 100) / 100,
        selected: targetWeightPct >= asset.currentWeightPct,
        volatilityPct: asset.volatilityPct
      };
    });
  const distribution = (raw.distribution ?? []).map((state) => {
    const bitstring = String(state.bitstring ?? "");

    return {
      bitstring,
      probability: toFiniteNumber(state.probability, 0),
      energy: toFiniteNumber(state.energy, toFiniteNumber(raw.energy, 0)),
      selectedSymbols: Array.isArray(state.selectedSymbols)
        ? state.selectedSymbols
        : buildSelectedSymbols(bitstring, assets, state.asset)
    };
  });

  return {
    id: raw.id ?? `manual-qaoa-${Date.now()}`,
    status: "completed",
    engine: "QAOA",
    device: raw.device ?? "Local Statevector QAOA Engine",
    library: raw.library ?? "statevector-js",
    qubits: toFiniteNumber(raw.qubits, assets.length),
    shots: toFiniteNumber(raw.shots, 0),
    depth: toFiniteNumber(raw.depth, 0),
    progressPct: toFiniteNumber(raw.progressPct, 100),
    energy: toFiniteNumber(raw.energy, 0),
    beta: toFiniteNumber(raw.beta, 0),
    gamma: toFiniteNumber(raw.gamma, 0),
    bestBitstring: raw.bestBitstring ?? distribution[0]?.bitstring ?? "",
    resultWeights,
    startedAt: raw.startedAt ?? now,
    completedAt: raw.completedAt ?? now,
    distribution,
    iterations: raw.iterations ?? [],
    assetResults,
    explanation: raw.explanation
  };
};

export const requestQuantumOptimization = async (assets: PortfolioAsset[]): Promise<QuantumTask> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(buildLocalApiUrl("/quantum/optimize"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Quantum optimizer returned ${response.status}`);
    }

    return normalizeQuantumTask((await response.json()) as RawQuantumTask, assets);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const getLatestQuantumOptimization = async (assets: PortfolioAsset[]): Promise<QuantumTask | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(buildLocalApiUrl("/quantum/latest"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Saved quantum result API returned ${response.status}`);
    }

    const data = (await response.json()) as { task?: RawQuantumTask | null };

    return data.task ? normalizeQuantumTask(data.task, assets) : null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
