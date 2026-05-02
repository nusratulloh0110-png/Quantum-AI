import { Fragment } from "react";
import type { AssetSymbol, CorrelationCell } from "../../domain/portfolio/types";

interface CorrelationHeatmapProps {
  symbols: AssetSymbol[];
  matrix: CorrelationCell[];
}

const getCellClassName = (value: number): string => {
  if (value >= 0.8) {
    return "bg-red-800 text-white";
  }

  if (value >= 0.6) {
    return "bg-red-200 text-red-950";
  }

  if (value >= 0.35) {
    return "bg-amber-100 text-amber-950";
  }

  return "bg-emerald-50 text-emerald-900";
};

export const CorrelationHeatmap = ({ symbols, matrix }: CorrelationHeatmapProps) => (
  <section className="panel">
    <div className="panel-header">
      <h2>Covariance Map</h2>
      <span>Sigma Matrix</span>
    </div>
    <div className="overflow-x-auto">
      <div className="correlation-grid" style={{ gridTemplateColumns: `72px repeat(${symbols.length}, 64px)` }}>
        <div />
        {symbols.map((symbol) => (
          <div key={symbol} className="heatmap-axis">
            {symbol}
          </div>
        ))}
        {symbols.map((rowSymbol) => (
          <Fragment key={`${rowSymbol}-row`}>
            <div key={`${rowSymbol}-axis`} className="heatmap-axis justify-start">
              {rowSymbol}
            </div>
            {symbols.map((columnSymbol) => {
              const cell = matrix.find((entry) => entry.x === rowSymbol && entry.y === columnSymbol);
              const value = cell?.value ?? 0;

              return (
                <div key={`${rowSymbol}-${columnSymbol}`} className={`heatmap-cell ${getCellClassName(value)}`}>
                  {value.toFixed(2)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  </section>
);
