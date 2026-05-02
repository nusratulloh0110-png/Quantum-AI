import type { PortfolioAsset } from "../../domain/portfolio/types";

const fallbackColors = ["#E8A030", "#5A9FD4", "#4CAF74", "#8A7FD4", "#C85450", "#7A7A82"];
const symbolColors: Record<string, string> = {
  BTC: "#E8A030",
  ETH: "#5A9FD4",
  SOL: "#4CAF74",
  BNB: "#8A7FD4",
  XRP: "#C85450"
};

interface AllocationChartProps {
  assets: PortfolioAsset[];
}

export const AllocationChart = ({ assets }: AllocationChartProps) => {
  return (
    <section className="panel allocation-panel">
      <div className="panel-header">
        <h2>Asset Allocation</h2>
        <span>Current Weights</span>
      </div>
      <div className="allocation-list">
        {assets.length === 0 ? <div className="empty-state">No allocation data.</div> : null}
        {assets.map((asset, index) => (
          <div key={asset.symbol} className="allocation-row">
            <span className="allocation-symbol">{asset.symbol}</span>
            <span className="allocation-track">
              <span
                className="allocation-fill"
                style={{
                  backgroundColor: symbolColors[asset.symbol] ?? fallbackColors[index % fallbackColors.length],
                  width: `${Math.min(Math.max(asset.currentWeightPct, 0), 100)}%`
                }}
              />
            </span>
            <span className="allocation-value">{asset.currentWeightPct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
};
