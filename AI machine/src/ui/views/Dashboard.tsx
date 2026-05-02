import type { PortfolioSnapshot } from "../../domain/portfolio/types";
import type { Language } from "../i18n";
import { AllocationChart } from "../components/AllocationChart";
import { Badge } from "../components/Badge";
import { MetricCard } from "../components/MetricCard";
import { RiskGauge } from "../components/RiskGauge";
import { formatCurrency, formatCurrencyPrecise, formatNeutralPct, formatPct } from "../formatters";

interface DashboardProps {
  snapshot: PortfolioSnapshot;
  language: Language;
}

const getActionLabel = (action: string): string => {
  if (action === "increase") {
    return "BUY";
  }

  if (action === "reduce") {
    return "SELL";
  }

  return "HOLD";
};

export const Dashboard = ({ snapshot, language }: DashboardProps) => {
  const isRu = language === "ru";
  const activeRecommendations = snapshot.recommendations.filter((recommendation) => recommendation.action !== "hold");
  const qaoaTotalDelta = (snapshot.quantumTask.assetResults ?? []).reduce((sum, asset) => sum + Math.abs(asset.deltaPct), 0);

  return (
    <div className="portfolio-terminal">
      {snapshot.assets.length === 0 ? (
        <section className="status-banner status-banner-warning">
          <strong>{isRu ? "Портфель пуст" : "Portfolio is empty"}</strong>
          <span>{isRu ? "Откройте раздел Активы и добавьте реальные позиции." : "Open Assets and add real positions."}</span>
        </section>
      ) : null}

      <div className="metric-strip">
        <MetricCard
          label={isRu ? "Баланс" : "Balance"}
          value={formatCurrency(snapshot.totalValueUsd)}
          detail={`${snapshot.marketData.livePriceCount}/${snapshot.marketData.totalAssetCount} ${isRu ? "активов" : "assets"} · CoinGecko`}
          trend={<span className="live-dot" />}
        />
        <MetricCard
          label={isRu ? "Вероятность просадки" : "Drawdown Probability"}
          value={formatNeutralPct(snapshot.risk.drawdownProbabilityPct)}
          detail={`${isRu ? "После QAOA" : "After QAOA"}: ${formatNeutralPct(snapshot.risk.optimizedDrawdownProbabilityPct)}`}
          tone="danger"
        />
        <MetricCard
          label={isRu ? "Целевая волатильность" : "Target Volatility"}
          value={formatNeutralPct(snapshot.risk.targetVolatilityPct)}
          detail={isRu ? "Расч. оценка портфеля" : "Portfolio model estimate"}
          tone="amber"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={snapshot.risk.sharpeRatio.toFixed(2)}
          detail={isRu ? "После оптимизации" : "Post-optimization"}
          tone="success"
        />
      </div>

      {snapshot.marketData.error ? (
        <section className="status-banner status-banner-warning">
          <strong>Market-data</strong>
          <span>{snapshot.marketData.error}</span>
        </section>
      ) : null}

      <div className="portfolio-grid">
        <section className="panel portfolio-main-panel">
          <div className="panel-header">
            <h2>{isRu ? "Позиции портфеля" : "Portfolio Positions"}</h2>
            <span>{isRu ? "QAOA -> веса" : "QAOA -> weights"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isRu ? "Актив" : "Asset"}</th>
                  <th>{isRu ? "Кластер" : "Cluster"}</th>
                  <th>{isRu ? "Кол-во" : "Amount"}</th>
                  <th>{isRu ? "Цена" : "Price"}</th>
                  <th>{isRu ? "Текущий" : "Current"}</th>
                  <th>{isRu ? "Цель" : "Target"}</th>
                  <th>24H</th>
                  <th>{isRu ? "Сигнал" : "Signal"}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.assets.map((asset) => {
                  const recommendation = snapshot.recommendations.find((entry) => entry.symbol === asset.symbol);
                  const action = recommendation ? getActionLabel(recommendation.action) : "HOLD";

                  return (
                    <tr key={asset.symbol}>
                      <td>
                        <div className="asset-symbol">{asset.symbol}</div>
                        <div className="asset-name">{asset.name}</div>
                      </td>
                      <td className="font-mono">{asset.covarianceCluster}</td>
                      <td className="font-mono">{asset.amount.toLocaleString("en-US")}</td>
                      <td className="font-mono">{formatCurrencyPrecise(asset.priceUsd)}</td>
                      <td className="font-mono">{formatNeutralPct(asset.currentWeightPct)}</td>
                      <td className="font-mono">{formatNeutralPct(asset.targetWeightPct)}</td>
                      <td className={`font-mono ${asset.dailyChangePct < 0 ? "text-crimson" : "text-emeraldStrict"}`}>
                        {formatPct(asset.dailyChangePct)}
                      </td>
                      <td>
                        <Badge tone={action === "SELL" ? "danger" : action === "BUY" ? "success" : "neutral"}>{action}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="execution-status-strip">
            <div>
              <span>Risk Score · Execution Status</span>
              <strong>{activeRecommendations.length} routed signals</strong>
            </div>
            <div className="execution-bars" aria-hidden="true">
              <span className="execution-bar execution-bar-danger" />
              <span className="execution-bar" />
              <span className="execution-bar" />
            </div>
          </div>
        </section>

        <aside className="portfolio-side-panel">
          <RiskGauge currentScore={snapshot.risk.currentRiskScore} optimizedScore={snapshot.risk.optimizedRiskScore} />
          <AllocationChart assets={snapshot.assets} />
          <section className="panel qaoa-readout-panel">
            <div className="qaoa-grid">
              <div>ENERGY&nbsp;&nbsp;&nbsp;&nbsp; · {snapshot.quantumTask.energy.toFixed(3)}</div>
              <div>TOTAL Δ&nbsp;&nbsp; · {formatNeutralPct(qaoaTotalDelta)}</div>
              <div>BETA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {snapshot.quantumTask.beta.toFixed(3)}</div>
              <div>GAMMA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {snapshot.quantumTask.gamma.toFixed(3)}</div>
              <div>КУБИТЫ&nbsp;&nbsp;&nbsp; · {snapshot.quantumTask.qubits}</div>
              <div>SHOTS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; · {snapshot.quantumTask.shots}</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
