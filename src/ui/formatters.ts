export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);

export const formatCurrencyPrecise = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

export const formatPct = (value: number, suffix = "%"): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;

export const formatNeutralPct = (value: number, suffix = "%"): string => `${value.toFixed(2)}${suffix}`;

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);

  return `${formatted}.${date.getMilliseconds().toString().padStart(3, "0")}`;
};
