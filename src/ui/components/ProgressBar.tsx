interface ProgressBarProps {
  value: number;
  tone?: "navy" | "success" | "danger" | "amber";
}

const toneClassName = {
  navy: "progress-bar-amber",
  success: "progress-bar-success",
  danger: "progress-bar-danger",
  amber: "progress-bar-amber"
};

export const ProgressBar = ({ value, tone = "navy" }: ProgressBarProps) => (
  <div className="progress-bar">
    <div className={`progress-bar-fill ${toneClassName[tone]}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
  </div>
);
