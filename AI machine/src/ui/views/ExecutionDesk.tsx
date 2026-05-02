import { useEffect, useMemo, useRef, useState } from "react";
import type { PortfolioSnapshot, RebalanceRecommendation } from "../../domain/portfolio/types";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { TerminalIcon } from "../components/TerminalIcon";
import { formatNeutralPct } from "../formatters";

type OrderStatus = "queued" | "routing" | "confirmed";

interface ExecutionDeskProps {
  snapshot: PortfolioSnapshot;
}

const getActionLabel = (recommendation: RebalanceRecommendation): string => {
  if (recommendation.action === "increase") {
    return "BUY";
  }

  if (recommendation.action === "reduce") {
    return "SELL";
  }

  return "HOLD";
};

const buildQueuedStatuses = (recommendations: RebalanceRecommendation[]): Record<string, OrderStatus> =>
  Object.fromEntries(recommendations.map((recommendation) => [recommendation.symbol, "queued" as OrderStatus]));

const sortByDeltaStrength = (recommendations: RebalanceRecommendation[]) =>
  [...recommendations].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

const buildQuantumReason = (recommendation: RebalanceRecommendation) => {
  const direction = recommendation.action === "increase" ? "выше" : "ниже";
  const pressure = recommendation.action === "increase" ? "добавить вес" : "снизить вес";
  const delta = `${recommendation.deltaPct > 0 ? "+" : ""}${recommendation.deltaPct.toFixed(2)} pp`;

  return `Целевой вес ${direction} текущего на ${delta}. Модель предлагает ${pressure}, потому что QAOA снижает нагрузку по концентрации и корреляции относительно текущего портфеля.`;
};

export const ExecutionDesk = ({ snapshot }: ExecutionDeskProps) => {
  const executableRecommendations = useMemo(
    () => snapshot.recommendations.filter((recommendation) => recommendation.action !== "hold"),
    [snapshot.recommendations]
  );
  const buyRecommendations = useMemo(
    () => sortByDeltaStrength(executableRecommendations.filter((recommendation) => recommendation.action === "increase")),
    [executableRecommendations]
  );
  const sellRecommendations = useMemo(
    () => sortByDeltaStrength(executableRecommendations.filter((recommendation) => recommendation.action === "reduce")),
    [executableRecommendations]
  );
  const strongestRecommendation = sortByDeltaStrength(executableRecommendations)[0];
  const [statuses, setStatuses] = useState<Record<string, OrderStatus>>(() => buildQueuedStatuses(executableRecommendations));
  const pendingTimers = useRef<number[]>([]);

  useEffect(() => {
    pendingTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    pendingTimers.current = [];
    setStatuses(buildQueuedStatuses(executableRecommendations));

    return () => {
      pendingTimers.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingTimers.current = [];
    };
  }, [executableRecommendations]);

  const confirmedCount = Object.values(statuses).filter((status) => status === "confirmed").length;
  const progress = executableRecommendations.length === 0 ? 100 : (confirmedCount / executableRecommendations.length) * 100;

  const previewPlan = () => {
    pendingTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    pendingTimers.current = [];
    setStatuses(buildQueuedStatuses(executableRecommendations));

    executableRecommendations.forEach((recommendation, index) => {
      const routingTimer = window.setTimeout(() => {
        setStatuses((current) => ({ ...current, [recommendation.symbol]: "routing" }));
      }, index * 350);
      const confirmedTimer = window.setTimeout(() => {
        setStatuses((current) => ({ ...current, [recommendation.symbol]: "confirmed" }));
      }, index * 350 + 850);
      pendingTimers.current.push(routingTimer, confirmedTimer);
    });
  };

  return (
    <div className="view-stack">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="panel">
          <div className="panel-header">
            <h2>Rebalance Plan</h2>
            <Badge tone="navy">Exchange review</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Action</th>
                  <th>Current</th>
                  <th>Target</th>
                  <th>Delta</th>
                  <th>Rationale</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {executableRecommendations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-slate-500">
                      Нет активных BUY/SELL сигналов. Портфель внутри допустимого диапазона модели.
                    </td>
                  </tr>
                ) : null}
                {executableRecommendations.map((recommendation) => (
                  <tr key={recommendation.symbol}>
                    <td className="font-mono font-medium text-slate-950">{recommendation.symbol}</td>
                    <td>
                      <Badge tone={recommendation.action === "reduce" ? "danger" : "success"}>{getActionLabel(recommendation)}</Badge>
                    </td>
                    <td className="font-mono">{formatNeutralPct(recommendation.currentWeightPct)}</td>
                    <td className="font-mono">{formatNeutralPct(recommendation.targetWeightPct)}</td>
                    <td className="font-mono">
                      {recommendation.deltaPct > 0 ? "+" : ""}
                      {recommendation.deltaPct.toFixed(2)} pp
                    </td>
                    <td className="max-w-md text-slate-600">{recommendation.rationale}</td>
                    <td>
                      <Badge tone={statuses[recommendation.symbol] === "confirmed" ? "success" : "neutral"}>
                        {statuses[recommendation.symbol]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Execution Control</h2>
            <span>Read-only order plan</span>
          </div>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Plan Confirmation</span>
                <span className="font-mono">{progress.toFixed(0)}%</span>
              </div>
              <ProgressBar value={progress} tone={progress === 100 ? "success" : "amber"} />
            </div>

            <div className="space-y-3">
              <div className="control-row">
                <TerminalIcon name="lock" size={16} />
                <span>Exchange keys</span>
                <Badge tone="warning">Not connected</Badge>
              </div>
              <div className="control-row">
                <TerminalIcon name="refresh" size={16} />
                <span>Quote refresh path</span>
                <Badge tone="navy">Ready</Badge>
              </div>
              <div className="control-row">
                <TerminalIcon name="check" size={16} />
                <span>Risk review</span>
                <Badge tone="success">Required</Badge>
              </div>
            </div>

            <button className="primary-button w-full" type="button" onClick={previewPlan} disabled={executableRecommendations.length === 0}>
              <TerminalIcon name="play" size={17} />
              <span>Preview Order Route</span>
            </button>
          </div>
        </section>
      </div>

      <section className="panel quantum-recommendation-panel">
        <div className="panel-header">
          <h2>Рекомендация от квантового компьютера</h2>
          <span>{snapshot.quantumTask.bestBitstring ? `bitstring ${snapshot.quantumTask.bestBitstring}` : "QAOA"}</span>
        </div>
        <div className="quantum-recommendation-summary">
          <TerminalIcon name="quantum" size={22} />
          <div>
            <strong>
              {strongestRecommendation
                ? `${getActionLabel(strongestRecommendation)} ${strongestRecommendation.symbol}: ${strongestRecommendation.deltaPct > 0 ? "+" : ""}${strongestRecommendation.deltaPct.toFixed(2)} pp`
                : "Активных сделок нет"}
            </strong>
            <p>
              {strongestRecommendation
                ? buildQuantumReason(strongestRecommendation)
                : "Квантовая модель не видит достаточно сильного отклонения между текущими и целевыми весами."}
            </p>
          </div>
        </div>

        <div className="quantum-recommendation-grid">
          <article className="quantum-recommendation-card quantum-recommendation-card-buy">
            <div className="quantum-recommendation-card-header">
              <TerminalIcon name="trend-up" size={18} />
              <h3>BUY</h3>
              <Badge tone="success">{buyRecommendations.length}</Badge>
            </div>
            <div className="quantum-recommendation-list">
              {buyRecommendations.length === 0 ? <div className="empty-state">BUY сигналов сейчас нет.</div> : null}
              {buyRecommendations.map((recommendation) => (
                <div key={recommendation.symbol} className="quantum-recommendation-item">
                  <div className="quantum-recommendation-metric">
                    <strong>{recommendation.symbol}</strong>
                    <span>
                      {recommendation.deltaPct > 0 ? "+" : ""}
                      {recommendation.deltaPct.toFixed(2)} pp
                    </span>
                  </div>
                  <p>{buildQuantumReason(recommendation)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="quantum-recommendation-card quantum-recommendation-card-sell">
            <div className="quantum-recommendation-card-header">
              <TerminalIcon name="trend-down" size={18} />
              <h3>SELL</h3>
              <Badge tone="danger">{sellRecommendations.length}</Badge>
            </div>
            <div className="quantum-recommendation-list">
              {sellRecommendations.length === 0 ? <div className="empty-state">SELL сигналов сейчас нет.</div> : null}
              {sellRecommendations.map((recommendation) => (
                <div key={recommendation.symbol} className="quantum-recommendation-item">
                  <div className="quantum-recommendation-metric">
                    <strong>{recommendation.symbol}</strong>
                    <span>
                      {recommendation.deltaPct > 0 ? "+" : ""}
                      {recommendation.deltaPct.toFixed(2)} pp
                    </span>
                  </div>
                  <p>{buildQuantumReason(recommendation)}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};
