import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: ReactNode;
  tone?: "default" | "danger" | "success" | "amber";
}

const toneClassName = {
  default: "metric-card-default",
  danger: "metric-card-danger",
  success: "metric-card-success",
  amber: "metric-card-amber"
};

export const MetricCard = ({ label, value, detail, trend, tone = "default" }: MetricCardProps) => (
  <section className={`metric-card ${toneClassName[tone]}`}>
    <div className="metric-card-head">
      <span className="metric-card-label">{label}</span>
      {trend ? <span className="metric-card-trend">{trend}</span> : null}
    </div>
    <div className="metric-card-value">{value}</div>
    {detail ? <p className="metric-card-detail">{detail}</p> : null}
  </section>
);
