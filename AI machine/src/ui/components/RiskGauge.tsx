interface RiskGaugeProps {
  currentScore: number;
  optimizedScore: number;
}

export const RiskGauge = ({ currentScore, optimizedScore }: RiskGaugeProps) => {
  const circumference = 2 * Math.PI * 42;
  const currentOffset = circumference - (currentScore / 100) * circumference;
  const optimizedOffset = circumference - (optimizedScore / 100) * circumference;

  return (
    <section className="panel risk-panel">
      <div className="panel-header">
        <h2>Risk Score</h2>
        <span>QAOA target</span>
      </div>
      <div className="risk-gauge-layout">
        <svg viewBox="0 0 100 100" className="risk-gauge-svg" aria-label="Risk Score Gauge">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bd-default)" strokeWidth="3" />
          <circle
            className="risk-ring-current"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--red)"
            strokeLinecap="square"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={currentOffset}
            transform="rotate(-90 50 50)"
          />
          <circle
            className="risk-ring-target"
            cx="50"
            cy="50"
            r="31"
            fill="none"
            stroke="rgba(76, 175, 116, 0.45)"
            strokeLinecap="square"
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 31}
            strokeDashoffset={optimizedOffset * (31 / 42)}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="50" textAnchor="middle" className="risk-score-number">
            {currentScore}
          </text>
          <text x="50" y="63" textAnchor="middle" className="risk-score-unit">
            /100
          </text>
        </svg>
        <div className="risk-gauge-readout">
          <div>Current · {currentScore}/100</div>
          <div className="text-emeraldStrict">QAOA цель · {optimizedScore}/100</div>
        </div>
      </div>
    </section>
  );
};
