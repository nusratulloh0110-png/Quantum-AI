import type { ManualPortfolioPosition, PortfolioRepository, PortfolioSnapshot } from "../../domain/portfolio/types";
import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

interface PositionsResponse {
  positions?: ManualPortfolioPosition[];
  error?: string;
}

const readApiJson = async <T extends { error?: string }>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(data.error || `Portfolio API returned ${response.status}`);
  }

  return data;
};

const withTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs = 15000): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export class LocalPortfolioRepository implements PortfolioRepository {
  async getPositions(): Promise<ManualPortfolioPosition[]> {
    const response = await withTimeout((signal) =>
      fetch(buildLocalApiUrl("/portfolio/positions"), {
        credentials: "include",
        signal
      })
    );
    const data = await readApiJson<PositionsResponse>(response);

    return data.positions ?? [];
  }

  async savePositions(positions: ManualPortfolioPosition[]): Promise<ManualPortfolioPosition[]> {
    const response = await withTimeout((signal) =>
      fetch(buildLocalApiUrl("/portfolio/positions"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
        signal
      })
    );
    const data = await readApiJson<PositionsResponse>(response);

    return data.positions ?? [];
  }

  async getSnapshot(): Promise<PortfolioSnapshot> {
    const response = await withTimeout((signal) =>
      fetch(buildLocalApiUrl("/portfolio/snapshot"), {
        method: "GET",
        credentials: "include",
        signal
      })
    );

    return readApiJson<PortfolioSnapshot & { error?: string }>(response);
  }
}
