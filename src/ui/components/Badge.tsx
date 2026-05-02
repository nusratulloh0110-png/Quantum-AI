import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "danger" | "warning" | "navy";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "terminal-badge-neutral",
  success: "terminal-badge-success",
  danger: "terminal-badge-danger",
  warning: "terminal-badge-warning",
  navy: "terminal-badge-amber"
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export const Badge = ({ children, tone = "neutral" }: BadgeProps) => (
  <span className={`terminal-badge ${toneClassName[tone]}`}>
    {children}
  </span>
);
