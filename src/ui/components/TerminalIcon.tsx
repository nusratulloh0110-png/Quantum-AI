import type { ReactNode, SVGProps } from "react";

export type TerminalIconName =
  | "portfolio"
  | "assets"
  | "market"
  | "quantum"
  | "execution"
  | "product"
  | "refresh"
  | "logout"
  | "credit"
  | "lock"
  | "mail"
  | "user"
  | "key"
  | "plus"
  | "save"
  | "trash"
  | "search"
  | "send"
  | "play"
  | "check"
  | "ban"
  | "dollar"
  | "users"
  | "database"
  | "trend-up"
  | "trend-down"
  | "timer"
  | "cpu"
  | "server"
  | "binary"
  | "message"
  | "google";

interface TerminalIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: TerminalIconName;
  size?: number;
  title?: string;
}

const iconPaths: Record<TerminalIconName, ReactNode> = {
  portfolio: (
    <>
      <rect x="2" y="5" width="12" height="9" />
      <path d="M5 5V3.5C5 2.67 5.67 2 6.5 2h3c.83 0 1.5.67 1.5 1.5V5" />
      <line x1="2" y1="9" x2="14" y2="9" />
    </>
  ),
  assets: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  market: <polyline points="2,11 5,7 8,9 11,5 14,7" />,
  quantum: (
    <>
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <line x1="5.5" y1="4" x2="10.5" y2="4" />
      <line x1="5.5" y1="12" x2="10.5" y2="12" />
      <line x1="4" y1="5.5" x2="4" y2="10.5" />
      <line x1="12" y1="5.5" x2="12" y2="10.5" />
    </>
  ),
  execution: (
    <>
      <path d="M3 8h7" />
      <path d="M10 8l-3-3m3 3l-3 3" />
      <line x1="13" y1="3" x2="13" y2="13" />
    </>
  ),
  product: (
    <>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </>
  ),
  refresh: (
    <>
      <path d="M13 6a5 5 0 0 0-8.7-2.5" />
      <path d="M4 2.5v3h3" />
      <path d="M3 10a5 5 0 0 0 8.7 2.5" />
      <path d="M12 13.5v-3H9" />
    </>
  ),
  logout: (
    <>
      <path d="M6 3H3v10h3" />
      <path d="M8 8h6" />
      <path d="M11 5l3 3-3 3" />
    </>
  ),
  credit: (
    <>
      <rect x="2" y="4" width="12" height="8" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="4" y1="10" x2="7" y2="10" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      <line x1="8" y1="10" x2="8" y2="12" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="12" height="9" />
      <path d="M2 5l6 4 6-4" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 14c.8-2.4 2.5-3.5 5-3.5s4.2 1.1 5 3.5" />
    </>
  ),
  key: (
    <>
      <circle cx="5" cy="8" r="3" />
      <path d="M8 8h6" />
      <path d="M11 8v2" />
      <path d="M13 8v2" />
    </>
  ),
  plus: (
    <>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </>
  ),
  save: (
    <>
      <path d="M3 2h8l2 2v10H3z" />
      <path d="M5 2v4h6V2" />
      <rect x="5" y="10" width="6" height="4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 5h10" />
      <path d="M6 5V3h4v2" />
      <path d="M4 5l1 9h6l1-9" />
      <line x1="7" y1="8" x2="7" y2="12" />
      <line x1="9" y1="8" x2="9" y2="12" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </>
  ),
  send: (
    <>
      <path d="M2 3l12 5-12 5 3-5z" />
      <line x1="5" y1="8" x2="14" y2="8" />
    </>
  ),
  play: <path d="M5 3l8 5-8 5z" />,
  check: <polyline points="3,8 6.5,11.5 13,4.5" />,
  ban: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <line x1="4.2" y1="4.2" x2="11.8" y2="11.8" />
    </>
  ),
  dollar: (
    <>
      <path d="M10.5 5.2C9.7 4.4 8.8 4 7.6 4 6.2 4 5 4.8 5 6c0 2.8 6 1.5 6 4 0 1.2-1.2 2-2.8 2-1.3 0-2.5-.5-3.3-1.4" />
      <line x1="8" y1="2" x2="8" y2="14" />
    </>
  ),
  users: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="11" cy="6" r="1.7" />
      <path d="M2.5 13c.6-2.2 1.8-3.2 3.5-3.2s2.9 1 3.5 3.2" />
      <path d="M9.5 11c1.4.1 2.5.8 3 2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" />
      <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  ),
  "trend-up": <polyline points="2,11 5.5,8 8,9.5 12.5,4.5 14,6" />,
  "trend-down": <polyline points="2,5 5.5,8 8,6.5 12.5,11.5 14,10" />,
  timer: (
    <>
      <circle cx="8" cy="8.5" r="5" />
      <path d="M6 2h4" />
      <path d="M8 8.5l2-2" />
    </>
  ),
  cpu: (
    <>
      <rect x="4" y="4" width="8" height="8" />
      <rect x="6.5" y="6.5" width="3" height="3" />
      <path d="M2 5h2M2 8h2M2 11h2M12 5h2M12 8h2M12 11h2M5 2v2M8 2v2M11 2v2M5 12v2M8 12v2M11 12v2" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3" width="10" height="4" />
      <rect x="3" y="9" width="10" height="4" />
      <line x1="5" y1="5" x2="5.5" y2="5" />
      <line x1="5" y1="11" x2="5.5" y2="11" />
    </>
  ),
  binary: (
    <>
      <path d="M4 3v10" />
      <path d="M11 3v10" />
      <path d="M2.5 4.5h3v3h-3z" />
      <circle cx="11" cy="11" r="1.8" />
    </>
  ),
  message: (
    <>
      <path d="M2.5 3.5h11v8h-6L4 14v-2.5H2.5z" />
      <line x1="5" y1="6.5" x2="11" y2="6.5" />
      <line x1="5" y1="8.5" x2="9" y2="8.5" />
    </>
  ),
  google: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M10.8 5.2A4 4 0 1 0 12 8H8" />
    </>
  )
};

export const TerminalIcon = ({ name, size = 16, title, className, ...props }: TerminalIconProps) => (
  <svg
    aria-hidden={title ? undefined : true}
    aria-label={title}
    className={`terminal-icon${className ? ` ${className}` : ""}`}
    fill="none"
    height={size}
    role={title ? "img" : undefined}
    stroke="currentColor"
    strokeLinecap="square"
    strokeLinejoin="miter"
    strokeWidth="1.2"
    viewBox="0 0 16 16"
    width={size}
    {...props}
  >
    {title ? <title>{title}</title> : null}
    {iconPaths[name]}
  </svg>
);

export const LogoMark = () => (
  <div className="logo-mark" aria-label="Quantum-AI Wealth Guardian">
    <span>Q</span>
  </div>
);
