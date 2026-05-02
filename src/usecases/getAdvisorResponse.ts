import type { PortfolioSnapshot } from "../domain/portfolio/types";

const fallbackResponse =
  "Summary: Локальный аналитический модуль оценил портфель и текущие целевые веса. Key Risks: основной вклад в риск дают концентрация, волатильность и корреляция активов. Actionable Insights: проверьте вкладку Квантовый расчет и используйте результат как аналитическую подсказку, а не как автоматическую торговую команду.";

export const getAdvisorResponse = (question: string, snapshot: PortfolioSnapshot): string => {
  const normalizedQuestion = question.toLowerCase();
  const highestDelta = [...snapshot.recommendations].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];

  if (normalizedQuestion.includes("sol") || normalizedQuestion.includes("solana")) {
    return "Summary: Модель проверяет SOL вместе с остальными L1-активами и оценивает его вклад в общий риск. Key Risks: если SOL имеет высокую волатильность или сильную корреляцию с ETH/BNB, QUBO штрафует такую концентрацию. Actionable Insights: сравните текущий и целевой вес SOL в таблице квантового расчета.";
  }

  if (normalizedQuestion.includes("btc") || normalizedQuestion.includes("бит")) {
    return "Summary: BTC остается базовым активом портфеля, но его вес ограничивается целевой волатильностью. Key Risks: слишком большая доля BTC повышает концентрационный риск и Value-at-Risk. Actionable Insights: ориентируйтесь на целевой вес из последнего QAOA-расчета.";
  }

  if (normalizedQuestion.includes("риск") || normalizedQuestion.includes("просад")) {
    return `Summary: расчетная вероятность просадки меняется с ${snapshot.risk.drawdownProbabilityPct}% до ${snapshot.risk.optimizedDrawdownProbabilityPct}%. Key Risks: текущий риск-скор ${snapshot.risk.currentRiskScore}/100 связан с концентрацией, волатильностью и корреляцией. Actionable Insights: квантовый расчет переводит портфель к risk-score ${snapshot.risk.optimizedRiskScore}/100.`;
  }

  if (highestDelta) {
    return `Summary: самое большое отклонение найдено по ${highestDelta.symbol}: ${highestDelta.deltaPct > 0 ? "+" : ""}${highestDelta.deltaPct} п.п. Key Risks: отклонение от целевых весов повышает расчетную волатильность портфеля. Actionable Insights: модель предлагает действие ${highestDelta.action.toUpperCase()} для возврата к оптимизированному профилю.`;
  }

  return fallbackResponse;
};
