import { useEffect, useMemo, useState } from "react";
import type { PortfolioSnapshot, QuantumTask } from "../../domain/portfolio/types";
import { getLatestQuantumOptimization, requestQuantumOptimization } from "../../infrastructure/quantum/LocalQuantumOptimizerClient";
import type { Language } from "../i18n";
import { Badge } from "../components/Badge";
import { CorrelationHeatmap } from "../components/CorrelationHeatmap";
import { ProgressBar } from "../components/ProgressBar";
import { SystemLog } from "../components/SystemLog";
import { TerminalIcon } from "../components/TerminalIcon";
import { formatDateTime, formatNeutralPct } from "../formatters";

interface QuantumLabProps {
  snapshot: PortfolioSnapshot;
  language: Language;
}

const getRunSteps = (language: Language) =>
  language === "ru"
    ? [
        ["Входные данные", "Берем активы, веса, волатильность, 24h-стресс и кластеры корреляции."],
        ["QUBO-модель", "Каждый актив становится бинарной переменной. Функция стоимости штрафует риск, концентрацию и ковариацию."],
        ["QAOA-расчет", "Локальный statevector-движок перебирает квантовые состояния и оценивает 4096 измерений."],
        ["Результат", "Минимальная энергия превращается в целевые веса и изменения по каждому активу."]
      ]
    : [
        ["Input", "The engine reads live assets, weights, volatility, 24h stress and covariance clusters."],
        ["QUBO model", "Each asset becomes a binary variable. The cost function penalizes risk, concentration and covariance."],
        ["QAOA run", "The local statevector engine evaluates quantum states and estimates 4096 measurement shots."],
        ["Result", "The lowest-energy state is converted into target weights and per-asset deltas."]
      ];

export const QuantumLab = ({ snapshot, language }: QuantumLabProps) => {
  const [quantumTask, setQuantumTask] = useState<QuantumTask | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingSavedRun, setIsLoadingSavedRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portfolioSignature = useMemo(
    () =>
      snapshot.assets
        .map((asset) => `${asset.symbol}:${asset.coinGeckoId}:${asset.amount}`)
        .sort()
        .join("|"),
    [snapshot.assets]
  );

  useEffect(() => {
    let isMounted = true;

    if (snapshot.assets.length === 0) {
      setQuantumTask(null);
      setError(null);
      return;
    }

    setIsLoadingSavedRun(true);
    setQuantumTask(null);
    getLatestQuantumOptimization(snapshot.assets)
      .then((savedTask) => {
        if (isMounted) {
          setQuantumTask(savedTask);
          setError(null);
        }
      })
      .catch((savedRunError) => {
        if (isMounted) {
          setError(savedRunError instanceof Error ? savedRunError.message : "Failed to load saved quantum result.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSavedRun(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [portfolioSignature]);

  const canRun = snapshot.assets.length > 0 && !isRunning && !isLoadingSavedRun;
  const totalAbsoluteDelta = useMemo(
    () => (quantumTask?.assetResults ?? []).reduce((sum, asset) => sum + Math.abs(asset.deltaPct), 0),
    [quantumTask]
  );
  const runEntries = useMemo(() => {
    if (!quantumTask) {
      return [];
    }

    return [
      { level: "QUANTUM" as const, timestamp: quantumTask.startedAt, message: `QAOA started with ${quantumTask.qubits} qubits and ${quantumTask.shots} shots.` },
      { level: "LOCAL" as const, timestamp: quantumTask.completedAt, message: `Best bitstring: ${quantumTask.bestBitstring}. Energy: ${quantumTask.energy}.` },
      { level: "RESULT" as const, timestamp: quantumTask.completedAt, message: `Generated ${quantumTask.assetResults?.length ?? 0} target weights.` }
    ];
  }, [quantumTask]);
  const quantumDistribution = quantumTask?.distribution ?? [];
  const quantumAssetResults = quantumTask?.assetResults ?? [];

  const handleRun = async () => {
    if (!snapshot.assets.length) {
      setError(language === "ru" ? "Сначала добавьте активы во вкладке Активы." : "Add assets first.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setQuantumTask(null);

    try {
      setQuantumTask(await requestQuantumOptimization(snapshot.assets));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Quantum calculation failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-header">
          <h2>{language === "ru" ? "Квантовый расчет портфеля" : "Quantum Portfolio Calculation"}</h2>
          <Badge tone={quantumTask ? "success" : "navy"}>{quantumTask ? "completed" : isLoadingSavedRun ? "loading" : "ready"}</Badge>
        </div>
        <div className="quantum-launch">
          <div className="quantum-launch-copy">
            <div className="text-sm font-medium text-slate-950">
              {quantumTask
                ? language === "ru"
                  ? "Последний расчет загружен"
                  : "Latest run loaded"
                : language === "ru"
                  ? "QUBO/QAOA готов к расчету"
                  : "QUBO/QAOA ready"}
            </div>
          </div>
          <button className="primary-button" type="button" onClick={handleRun} disabled={!canRun}>
            <TerminalIcon name={isRunning ? "refresh" : "play"} className={isRunning ? "spin-icon" : ""} size={17} />
            <span>{isRunning ? (language === "ru" ? "Расчет идет" : "Running") : language === "ru" ? "Запустить расчет" : "Run calculation"}</span>
          </button>
        </div>
        {error ? <div className="status-banner status-banner-warning mt-4">{error}</div> : null}
        {isRunning || isLoadingSavedRun ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {isLoadingSavedRun
                  ? language === "ru"
                    ? "Проверяем сохраненный результат"
                    : "Checking saved result"
                  : language === "ru"
                    ? "Backend считает состояние QAOA"
                    : "Backend is calculating QAOA state"}
              </span>
              <span className="font-mono">...</span>
            </div>
            <ProgressBar value={isLoadingSavedRun ? 38 : 72} tone="amber" />
          </div>
        ) : null}
      </section>

      {quantumTask ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
            <section className="panel">
              <div className="panel-header">
                <h2>{language === "ru" ? "Итог расчета" : "Run Result"}</h2>
                <Badge tone="success">{quantumTask.status}</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{language === "ru" ? "Готовность оптимизации" : "Optimization Progress"}</span>
                    <span className="font-mono">{quantumTask.progressPct}%</span>
                  </div>
                  <ProgressBar value={quantumTask.progressPct} tone="success" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="stat-box">
                    <TerminalIcon name="cpu" size={16} />
                    <span>{language === "ru" ? "Кубиты" : "Qubits"}</span>
                    <strong>{quantumTask.qubits}</strong>
                  </div>
                  <div className="stat-box">
                    <TerminalIcon name="server" size={16} />
                    <span>Shots</span>
                    <strong>{quantumTask.shots}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>{language === "ru" ? "Параметры QUBO/QAOA" : "QUBO/QAOA Parameters"}</h2>
                <span>{quantumTask.library}</span>
              </div>
              <div className="qaoa-grid">
                <div>ENERGY&nbsp;&nbsp;&nbsp;&nbsp; · {quantumTask.energy.toFixed(3)}</div>
                <div>TOTAL Δ&nbsp;&nbsp; · {formatNeutralPct(totalAbsoluteDelta)}</div>
                <div>BETA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {quantumTask.beta.toFixed(3)}</div>
                <div>GAMMA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {quantumTask.gamma.toFixed(3)}</div>
                <div>КУБИТЫ&nbsp;&nbsp;&nbsp; · {quantumTask.qubits}</div>
                <div>SHOTS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {quantumTask.shots}</div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Runtime</h2>
                <span>{quantumTask.device}</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 border border-slate-200 px-3 py-3">
                  <TerminalIcon name="timer" size={17} className="mt-0.5 text-navy" />
                  <div>
                    <div className="text-xs uppercase text-slate-500">Started</div>
                    <div className="mt-1 font-mono text-slate-950">{formatDateTime(quantumTask.startedAt)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 border border-slate-200 px-3 py-3">
                  <TerminalIcon name="timer" size={17} className="mt-0.5 text-emeraldStrict" />
                  <div>
                    <div className="text-xs uppercase text-slate-500">Completed</div>
                    <div className="mt-1 font-mono text-slate-950">{formatDateTime(quantumTask.completedAt)}</div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>{language === "ru" ? "Как работает квантовый расчет" : "How The Quantum Run Works"}</h2>
              <span>{"QUBO -> QAOA -> weights"}</span>
            </div>
            <div className="quantum-process-grid">
              {getRunSteps(language).map(([title, body], index) => (
                <article key={title} className="quantum-process-step">
                  <div className="quantum-step-index">{index + 1}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
            <section className="panel">
              <div className="panel-header">
                <h2>{language === "ru" ? "Ответ расчета по активам" : "Asset-Level Answer"}</h2>
                <span>{language === "ru" ? "Целевые веса" : "Target weights"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Qubit</th>
                      <th>Current</th>
                      <th>Target</th>
                      <th>Delta</th>
                      <th>Volatility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quantumAssetResults.map((asset) => (
                      <tr key={asset.symbol}>
                        <td className="font-mono font-medium text-slate-950">{asset.symbol}</td>
                        <td>
                          <Badge tone={asset.selected ? "success" : "neutral"}>{asset.selected ? "1" : "0"}</Badge>
                        </td>
                        <td className="font-mono">{formatNeutralPct(asset.currentWeightPct)}</td>
                        <td className="font-mono">{formatNeutralPct(asset.targetWeightPct)}</td>
                        <td className={`font-mono ${asset.deltaPct < 0 ? "text-crimson" : "text-emeraldStrict"}`}>
                          {asset.deltaPct > 0 ? "+" : ""}
                          {asset.deltaPct.toFixed(2)} pp
                        </td>
                        <td className="font-mono">{formatNeutralPct(asset.volatilityPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>{language === "ru" ? "Вероятности состояний" : "State Probabilities"}</h2>
                <span>{quantumTask.bestBitstring}</span>
              </div>
              <div className="space-y-3">
                {quantumDistribution.length === 0 ? (
                  <div className="empty-state">{language === "ru" ? "Нет распределения состояний в ответе backend." : "No state distribution returned by backend."}</div>
                ) : null}
                {quantumDistribution.map((state, index) => (
                  <div key={`${state.bitstring}-${index}`} className="quantum-state-row">
                    <div className="flex items-center gap-2">
                      <TerminalIcon name="binary" size={15} className="text-navy" />
                      <span className="font-mono text-sm text-slate-950">{state.bitstring}</span>
                      <span className="min-w-0 truncate text-xs text-slate-500">{(state.selectedSymbols ?? []).join(", ") || "no selected assets"}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="quantum-probability-track">
                        <div className="quantum-probability-bar" style={{ width: `${Math.min(state.probability * 100, 100)}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-xs text-slate-500">{(state.probability * 100).toFixed(2)}%</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">Energy {Number(state.energy ?? 0).toFixed(3)}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
            <CorrelationHeatmap symbols={snapshot.assets.map((asset) => asset.symbol)} matrix={snapshot.correlationMatrix} />
            <SystemLog title={language === "ru" ? "Лог запущенного расчета" : "Run Log"} entries={runEntries} />
          </div>
        </>
      ) : null}
    </div>
  );
};
