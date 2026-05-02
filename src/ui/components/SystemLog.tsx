import type { InsightLogEntry } from "../../domain/portfolio/types";
import { formatDateTime } from "../formatters";

interface SystemLogProps {
  entries: InsightLogEntry[];
  title?: string;
  subtitle?: string;
}

export const SystemLog = ({ entries, title = "Quantum Insight Log", subtitle = "Terminal Output" }: SystemLogProps) => (
  <section className="panel">
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{subtitle}</span>
    </div>
    <div className="terminal-log">
      {entries.map((entry, index) => (
        <div key={`${entry.level}-${index}`} className="terminal-log-row">
          <span className="w-24 text-slate-400">{formatDateTime(entry.timestamp).slice(12)}</span>
          <span className="w-20 text-blue-300">[{entry.level}]</span>
          <span className="min-w-0 text-slate-200">{entry.message}</span>
        </div>
      ))}
    </div>
  </section>
);
