import { FormEvent, useEffect, useState } from "react";
import type { ManualPortfolioPosition } from "../../domain/portfolio/types";
import type { Language } from "../i18n";
import { Badge } from "../components/Badge";
import { TerminalIcon } from "../components/TerminalIcon";

interface PortfolioSetupProps {
  freeAssetLimit?: number;
  isPro?: boolean;
  language: Language;
  positions: ManualPortfolioPosition[];
  onSave: (positions: ManualPortfolioPosition[]) => Promise<void> | void;
  onUpgrade?: () => void;
}

const emptyPosition: ManualPortfolioPosition = {
  symbol: "",
  coinGeckoId: "",
  name: "",
  amount: 0
};

export const PortfolioSetup = ({
  freeAssetLimit = 10,
  isPro = false,
  language,
  positions,
  onSave,
  onUpgrade
}: PortfolioSetupProps) => {
  const [draft, setDraft] = useState<ManualPortfolioPosition[]>(positions.length > 0 ? positions : [emptyPosition]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const planLabel = isPro ? "PRO" : `FREE ${draft.length}/${freeAssetLimit}`;
  const freeLimitMessage =
    language === "ru"
      ? `FREE план включает до ${freeAssetLimit} активов. Удалите лишние строки или включите PRO за $1 в месяц.`
      : `The FREE plan includes up to ${freeAssetLimit} assets. Remove extra rows or activate PRO for $1 per month.`;

  useEffect(() => {
    setDraft(positions.length > 0 ? positions : [emptyPosition]);
  }, [positions]);

  const copy = (nextPositions: ManualPortfolioPosition[]) => {
    setValidationError(null);
    setDraft(nextPositions.length > 0 ? nextPositions : [emptyPosition]);
  };

  const handleAddPosition = () => {
    if (!isPro && draft.length >= freeAssetLimit) {
      setValidationError(freeLimitMessage);
      return;
    }

    copy([...draft, emptyPosition]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = draft
      .map((position) => ({
        ...position,
        symbol: position.symbol.trim().toUpperCase(),
        coinGeckoId: position.coinGeckoId.trim(),
        name: position.name.trim() || position.symbol.trim().toUpperCase(),
        amount: Number(position.amount)
      }))
      .filter((position) => position.symbol && position.coinGeckoId && Number.isFinite(position.amount) && position.amount > 0);

    if (cleaned.length === 0) {
      setValidationError(language === "ru" ? "Добавьте хотя бы один актив с положительным количеством." : "Add at least one asset with a positive amount.");
      return;
    }

    if (!isPro && cleaned.length > freeAssetLimit) {
      setValidationError(freeLimitMessage);
      return;
    }

    setValidationError(null);
    setIsSaving(true);

    try {
      await onSave(cleaned);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : language === "ru" ? "Не удалось сохранить активы." : "Failed to save assets.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-header">
          <h2>{language === "ru" ? "Ваш портфель" : "Your Portfolio"}</h2>
          <div className="panel-badge-row">
            <Badge tone={isPro ? "success" : "warning"}>{planLabel}</Badge>
            <Badge tone="navy">{language === "ru" ? "Реальные данные" : "Real data"}</Badge>
          </div>
        </div>
        <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-600">
          {language === "ru"
            ? "Введите активы, CoinGecko ID и количество. Система использует эти данные для живых цен, риск-метрик и ручного запуска QAOA-расчета."
            : "Enter assets, CoinGecko IDs and amounts. The system uses these values for live prices, risk metrics and manual QAOA runs."}
        </p>
        {!isPro ? (
          <div className="plan-limit-note">
            <strong>FREE</strong>
            <span>
              {language === "ru"
                ? `До ${freeAssetLimit} активов в аккаунте. PRO снимает этот лимит и стоит $1 в месяц.`
                : `Up to ${freeAssetLimit} assets per account. PRO removes this limit and costs $1 per month.`}
            </span>
            {onUpgrade ? (
              <button type="button" onClick={onUpgrade}>
                {language === "ru" ? "Включить PRO" : "Activate PRO"}
              </button>
            ) : null}
          </div>
        ) : null}
        {validationError ? <div className="status-banner status-banner-warning mb-4">{validationError}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>CoinGecko ID</th>
                  <th>Name</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.map((position, index) => (
                  <tr key={`${position.symbol}-${index}`}>
                    <td>
                      <input
                        value={position.symbol}
                        onChange={(event) => {
                          const next = [...draft];
                          next[index] = { ...position, symbol: event.target.value };
                          copy(next);
                        }}
                        className="table-input font-mono"
                        placeholder="BTC"
                      />
                    </td>
                    <td>
                      <input
                        value={position.coinGeckoId}
                        onChange={(event) => {
                          const next = [...draft];
                          next[index] = { ...position, coinGeckoId: event.target.value };
                          copy(next);
                        }}
                        className="table-input font-mono"
                        placeholder="bitcoin"
                      />
                    </td>
                    <td>
                      <input
                        value={position.name}
                        onChange={(event) => {
                          const next = [...draft];
                          next[index] = { ...position, name: event.target.value };
                          copy(next);
                        }}
                        className="table-input"
                        placeholder="Bitcoin"
                      />
                    </td>
                    <td>
                      <input
                        value={position.amount}
                        type="number"
                        min="0"
                        step="any"
                        onChange={(event) => {
                          const next = [...draft];
                          next[index] = { ...position, amount: Number(event.target.value) };
                          copy(next);
                        }}
                        className="table-input font-mono"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-icon-button"
                        aria-label="Remove asset"
                        onClick={() => copy(draft.filter((_, rowIndex) => rowIndex !== index))}
                        disabled={isSaving}
                      >
                        <TerminalIcon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={handleAddPosition} disabled={isSaving}>
              <TerminalIcon name="plus" size={16} />
              <span>{language === "ru" ? "Добавить актив" : "Add asset"}</span>
            </button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              <TerminalIcon name="save" size={16} />
              <span>{language === "ru" ? "Сохранить и обновить" : "Save and refresh"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
