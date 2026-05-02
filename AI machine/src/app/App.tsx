import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ManualPortfolioPosition, PortfolioSnapshot } from "../domain/portfolio/types";
import { LocalAuthClient } from "../infrastructure/auth/LocalAuthClient";
import type { AuthUser } from "../infrastructure/auth/LocalAuthClient";
import { LocalMarketDataProvider } from "../infrastructure/market/LocalMarketDataProvider";
import { LocalPortfolioRepository } from "../infrastructure/repositories/LocalPortfolioRepository";
import { getGuardianSnapshot } from "../usecases/getGuardianSnapshot";
import { AdvisorPanel } from "../ui/components/AdvisorPanel";
import { Badge } from "../ui/components/Badge";
import { AuthScreen } from "../ui/views/AuthScreen";
import { Dashboard } from "../ui/views/Dashboard";
import { ExecutionDesk } from "../ui/views/ExecutionDesk";
import { AssetUniverse } from "../ui/views/AssetUniverse";
import { PortfolioSetup } from "../ui/views/PortfolioSetup";
import { ProductGuide } from "../ui/views/ProductGuide";
import { QuantumLab } from "../ui/views/QuantumLab";
import { formatCurrencyPrecise, formatDateTime, formatPct } from "../ui/formatters";
import type { Language } from "../ui/i18n";
import { uiText } from "../ui/i18n";
import { LogoMark, TerminalIcon } from "../ui/components/TerminalIcon";
import type { TerminalIconName } from "../ui/components/TerminalIcon";
import { appConfig } from "./config";

type ViewId = "dashboard" | "quantum" | "execution" | "setup" | "universe" | "guide";

interface NavItem {
  id: ViewId;
  labelKey: keyof typeof uiText.ru;
  icon: TerminalIconName;
}

const navItems: NavItem[] = [
  { id: "dashboard", labelKey: "dashboard", icon: "portfolio" },
  { id: "setup", labelKey: "setup", icon: "assets" },
  { id: "universe", labelKey: "universe", icon: "market" },
  { id: "quantum", labelKey: "quantum", icon: "quantum" },
  { id: "execution", labelKey: "execution", icon: "execution" },
  { id: "guide", labelKey: "guide", icon: "product" }
];

const marketDataProvider = new LocalMarketDataProvider();
const repository = new LocalPortfolioRepository();
const authClient = new LocalAuthClient();
const monthlySubscriptionPriceUsd = 1;
const freePlanAssetLimit = 10;

const hasBillingAccess = (user: AuthUser | null): boolean => {
  const status = user?.billing?.status ?? "";

  if (!["active", "trialing"].includes(status)) {
    return false;
  }

  const periodEnd = user?.billing?.currentPeriodEnd;

  return !periodEnd || Number.isNaN(Date.parse(periodEnd)) || Date.parse(periodEnd) > Date.now();
};

const buildEmptySnapshot = (): PortfolioSnapshot => {
  const now = new Date().toISOString();

  return {
    totalValueUsd: 0,
    updatedAt: now,
    portfolioSource: {
      provider: "manual_runtime",
      status: "fallback",
      assetCount: 0,
      description: "No portfolio positions are active. Add assets to start pricing and risk calculations."
    },
    marketData: {
      provider: "CoinGecko",
      status: "fallback",
      livePriceCount: 0,
      totalAssetCount: 0,
      lastUpdatedAt: null
    },
    assets: [],
    risk: {
      riskToleranceScore: 0,
      currentRiskScore: 0,
      optimizedRiskScore: 0,
      drawdownProbabilityPct: 0,
      optimizedDrawdownProbabilityPct: 0,
      valueAtRiskPct: 0,
      targetVolatilityPct: 0,
      sharpeRatio: 0
    },
    quantumTask: {
      id: "not-started",
      status: "pending",
      engine: "QAOA",
      device: "Local Statevector QAOA Engine",
      library: "statevector-js",
      qubits: 0,
      shots: 0,
      depth: 0,
      progressPct: 0,
      energy: 0,
      beta: 0,
      gamma: 0,
      bestBitstring: "",
      resultWeights: {},
      startedAt: now,
      completedAt: now,
      distribution: [],
      iterations: [],
      assetResults: []
    },
    correlationMatrix: [],
    frontier: [],
    insightLog: [],
    recommendations: [],
    stressSignals: [
      { name: "Portfolio source", value: "empty", severity: "medium" },
      { name: "Market data coverage", value: "0/0", severity: "high" },
      { name: "QAOA runtime", value: "waiting for assets", severity: "medium" }
    ],
    advisorMessages: []
  };
};

const fallbackTickerAssets = [
  { symbol: "BTC", priceUsd: 78234, dailyChangePct: 1.18 },
  { symbol: "ETH", priceUsd: 2300, dailyChangePct: 0.72 },
  { symbol: "SOL", priceUsd: 142.8, dailyChangePct: -0.34 },
  { symbol: "BNB", priceUsd: 615.2, dailyChangePct: -0.59 },
  { symbol: "XRP", priceUsd: 1.38, dailyChangePct: 0.58 }
];

const MarketTicker = ({ snapshot }: { snapshot: PortfolioSnapshot }) => {
  const tickerAssets =
    snapshot.assets.length > 0
      ? snapshot.assets.map((asset) => ({
          symbol: asset.symbol,
          priceUsd: asset.priceUsd,
          dailyChangePct: asset.dailyChangePct
        }))
      : fallbackTickerAssets;
  const doubledAssets = [...tickerAssets, ...tickerAssets];

  return (
    <div className="market-ticker" aria-label="Live quote ticker">
      <div className="ticker-scroll">
        {doubledAssets.map((asset, index) => (
          <span className="ticker-item" key={`${asset.symbol}-${index}`}>
            <span>{asset.symbol}</span>
            <span>·</span>
            <span>{formatCurrencyPrecise(asset.priceUsd)}</span>
            <span className={asset.dailyChangePct < 0 ? "ticker-negative" : "ticker-positive"}>{formatPct(asset.dailyChangePct)}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

interface BlockedAccountScreenProps {
  user: AuthUser;
  language: Language;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const BlockedAccountScreen = ({ user, language, onLogout, onRefresh }: BlockedAccountScreenProps) => {
  const isRu = language === "ru";

  return (
    <main className="blocked-account-shell">
      <section className="blocked-account-panel">
        <LogoMark />
        <div>
          <h1>{isRu ? "Аккаунт заблокирован" : "Account blocked"}</h1>
          <p>{user.email}</p>
        </div>
        <dl className="blocked-account-grid">
          <div>
            <dt>{isRu ? "Баланс" : "Balance"}</dt>
            <dd>{formatCurrencyPrecise(user.balanceUsd)}</dd>
          </div>
          <div>
            <dt>{isRu ? "Дата блокировки" : "Blocked at"}</dt>
            <dd>{user.blockedAt ? formatDateTime(user.blockedAt) : "-"}</dd>
          </div>
        </dl>
        {user.blockedReason ? <div className="blocked-account-reason">{user.blockedReason}</div> : null}
        <div className="blocked-account-actions">
          <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
            <TerminalIcon name="refresh" size={17} />
            <span>{isRu ? "Проверить статус" : "Refresh status"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => void onLogout()}>
            <TerminalIcon name="logout" size={17} />
            <span>{isRu ? "Выйти" : "Logout"}</span>
          </button>
        </div>
      </section>
    </main>
  );
};

interface BillingRequiredScreenProps {
  user: AuthUser;
  language: Language;
  isLoading: boolean;
  error: string | null;
  onStripe: () => Promise<void>;
  onBalance: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const BillingRequiredScreen = ({ user, language, isLoading, error, onStripe, onBalance, onRefresh, onLogout }: BillingRequiredScreenProps) => {
  const isRu = language === "ru";
  const canUseBalance = user.balanceUsd >= monthlySubscriptionPriceUsd;
  const featureItems: Array<{ icon: TerminalIconName; title: string; body: string }> = isRu
    ? [
        {
          icon: "portfolio",
          title: "Контроль портфеля",
          body: "Видно вес каждого актива, цену, 24h-движение, концентрацию и отклонение от целевых весов."
        },
        {
          icon: "assets",
          title: "Ввод активов",
          body: "Можно вручную задать позиции, CoinGecko ID, количество и быстро получить расчёт по реальному портфелю."
        },
        {
          icon: "market",
          title: "Рыночный контур",
          body: "Поиск активов, цены, ранги и дневное движение подтягиваются через market-data слой."
        },
        {
          icon: "quantum",
          title: "QAOA-оптимизация",
          body: "Локальный квантовый расчёт ищет более сбалансированное распределение между риском, корреляцией и весами."
        },
        {
          icon: "execution",
          title: "План ребаланса",
          body: "Терминал показывает BUY/SELL/HOLD-сигналы и объясняет, что именно нужно изменить перед исполнением."
        },
        {
          icon: "message",
          title: "AI-разбор",
          body: "Аналитический помощник объясняет риск, просадку, сильные отклонения и результат расчёта простым языком."
        }
      ]
    : [
        {
          icon: "portfolio",
          title: "Portfolio control",
          body: "Track asset weights, live prices, 24h movement, concentration and target-weight drift."
        },
        {
          icon: "assets",
          title: "Asset input",
          body: "Enter holdings, CoinGecko IDs and amounts manually to calculate from the real account portfolio."
        },
        {
          icon: "market",
          title: "Market layer",
          body: "Search assets, inspect prices, ranks and daily movement through the market-data layer."
        },
        {
          icon: "quantum",
          title: "QAOA optimization",
          body: "The local quantum run searches for a better risk, covariance and allocation balance."
        },
        {
          icon: "execution",
          title: "Rebalance plan",
          body: "The terminal produces BUY/SELL/HOLD signals and explains what should change before execution."
        },
        {
          icon: "message",
          title: "AI analysis",
          body: "The advisor explains risk, drawdown, allocation drift and model output in plain language."
        }
      ];
  const valueItems = isRu
    ? [
        ["Экономия времени", "не собирать цены, веса и сигналы вручную"],
        ["Меньше ошибок", "ребаланс виден до действия, а не после просадки"],
        ["Дисциплина риска", "видно, где портфель перегружен одним активом"],
        ["Понятная цена", "$1 в месяц, можно списать с баланса"]
      ]
    : [
        ["Time saved", "no manual price, weight and signal collection"],
        ["Fewer mistakes", "rebalance is visible before drawdown pain"],
        ["Risk discipline", "see where the portfolio is overloaded"],
        ["Clear pricing", "$1 per month, payable from balance"]
      ];

  return (
    <main className="billing-required-shell">
      <section className="billing-required-panel">
        <div className="billing-hero">
          <div className="billing-required-head">
            <LogoMark />
            <div>
              <span className="billing-kicker">TRADING FLOOR ACCESS</span>
              <h1>{isRu ? "Quantum-AI Wealth Guardian" : "Quantum-AI Wealth Guardian"}</h1>
              <p>
                {isRu
                  ? "Профессиональный терминал для контроля риска, ребаланса и квантового расчёта портфеля. Он не обещает гарантированную прибыль, но помогает видеть, где деньги перегружены риском и где можно действовать дисциплинированнее."
                  : "A professional terminal for risk control, rebalance planning and quantum portfolio calculations. It does not promise guaranteed profit, but helps reveal where capital is overloaded with risk and where action can be more disciplined."}
              </p>
            </div>
          </div>

          <div className="billing-visual" aria-hidden="true">
            <div className="billing-chart-head">
              <span>RISK</span>
              <strong>96 → 84</strong>
            </div>
            <svg className="billing-line-chart" viewBox="0 0 320 140">
              <path className="billing-grid-line" d="M10 35H310M10 70H310M10 105H310" />
              <path className="billing-risk-line" d="M12 28 C58 24 80 72 124 67 S182 108 226 78 S268 42 308 54" />
              <path className="billing-target-line" d="M12 94 C64 88 94 82 132 76 S210 64 308 42" />
            </svg>
            <div className="billing-bars">
              <span style={{ "--bar": "82%" } as CSSProperties} />
              <span style={{ "--bar": "56%" } as CSSProperties} />
              <span style={{ "--bar": "38%" } as CSSProperties} />
              <span style={{ "--bar": "22%" } as CSSProperties} />
            </div>
          </div>
        </div>

        <div className="billing-deal-row">
          <div className="billing-price-readout">
            <span>{isRu ? "Стоимость" : "Price"}</span>
            <strong>$1.00 / {isRu ? "месяц" : "month"}</strong>
          </div>
          <div className="billing-balance-readout">
            <span>{isRu ? "Ваш баланс" : "Your balance"}</span>
            <strong>{formatCurrencyPrecise(user.balanceUsd)}</strong>
          </div>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="billing-required-actions">
          <button className="primary-button" disabled={!canUseBalance || isLoading} type="button" onClick={() => void onBalance()}>
            <TerminalIcon name="credit" size={17} />
            <span>{isRu ? "Списать $1 с баланса" : "Use $1 balance"}</span>
          </button>
          <button className="secondary-button" disabled={isLoading} type="button" onClick={() => void onStripe()}>
            <TerminalIcon name="credit" size={17} />
            <span>{isRu ? "Оформить через Stripe" : "Subscribe with Stripe"}</span>
          </button>
          <button className="secondary-button" disabled={isLoading} type="button" onClick={() => void onRefresh()}>
            <TerminalIcon name="refresh" size={17} />
            <span>{isRu ? "Проверить статус" : "Refresh status"}</span>
          </button>
          <button className="secondary-button" disabled={isLoading} type="button" onClick={() => void onLogout()}>
            <TerminalIcon name="logout" size={17} />
            <span>{isRu ? "Выйти" : "Logout"}</span>
          </button>
        </div>

        <div className="billing-feature-grid">
          {featureItems.map((item) => (
            <article className="billing-feature-card" key={item.title}>
              <TerminalIcon name={item.icon} size={18} />
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="billing-value-panel">
          <div>
            <h2>{isRu ? "В чём профит" : "Where it helps"}</h2>
            <p>
              {isRu
                ? "Главная польза не в красивом графике, а в экономии внимания: терминал собирает рыночные данные, считает риск и показывает план до того, как решение станет дорогой ошибкой."
                : "The value is not decoration. The terminal saves attention by collecting market data, calculating risk and showing a plan before a decision becomes an expensive mistake."}
            </p>
          </div>
          <div className="billing-value-list">
            {valueItems.map(([title, body]) => (
              <div key={title}>
                <span>{title}</span>
                <strong>{body}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="billing-tech-strip">
          <span>CoinGecko market data</span>
          <span>QUBO / QAOA local engine</span>
          <span>Risk scoring</span>
          <span>AI analytics</span>
          <span>Stripe / balance billing</span>
        </div>

        {!canUseBalance ? (
          <p className="billing-required-note">
            {isRu
              ? "На балансе меньше $1. Пополните баланс у администратора или используйте Stripe."
              : "Balance is below $1. Add balance through an admin or use Stripe."}
          </p>
        ) : null}
      </section>
    </main>
  );
};

export const App = () => {
  const [activeView, setActiveView] = useState<ViewId>("setup");
  const [language, setLanguage] = useState<Language>(() => (window.localStorage.getItem("qwg.language") === "en" ? "en" : "ru"));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isPortfolioReady, setIsPortfolioReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [manualPositions, setManualPositions] = useState<ManualPortfolioPosition[]>([]);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const t = uiText[language];
  const hasActiveSubscription = hasBillingAccess(authUser);

  const loadSnapshot = useCallback(async () => {
    if (!authUser || authUser.isBlocked || !isPortfolioReady) {
      setSnapshot(null);
      setIsRefreshing(false);
      return;
    }

    if (manualPositions.length === 0) {
      setSnapshot(buildEmptySnapshot());
      setLoadError(null);
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);

    try {
      const nextSnapshot = await getGuardianSnapshot(repository);
      setSnapshot(nextSnapshot);
      setLoadError(null);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Failed to load portfolio snapshot.";
      const isFreePlanLimit = rawMessage.toLowerCase().includes("free plan");
      const message =
        isFreePlanLimit && language === "ru"
          ? `FREE план включает до ${freePlanAssetLimit} активов. Удалите лишние строки или включите PRO.`
          : rawMessage;
      setLoadError(message);

      if (isFreePlanLimit) {
        setActiveView("setup");
        setSnapshot(buildEmptySnapshot());
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [authUser, isPortfolioReady, language, manualPositions]);

  useEffect(() => {
    let isMounted = true;

    authClient
      .getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setAuthUser(user);
          setAuthError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAuthError(error instanceof Error ? error.message : "Failed to check session.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const loadAccountPositions = useCallback(async () => {
    if (!authUser || authUser.isBlocked) {
      setManualPositions([]);
      setIsPortfolioReady(false);
      setSnapshot(null);
      return;
    }

    setIsPortfolioReady(false);
    setSnapshot(null);

    try {
      const positions = await repository.getPositions();
      setManualPositions(positions);
      setActiveView(positions.length > 0 ? "dashboard" : "setup");
      setLoadError(null);
      setIsPortfolioReady(true);
    } catch (error) {
      setManualPositions([]);
      setActiveView("setup");
      setLoadError(error instanceof Error ? error.message : "Failed to load account assets.");
      setIsPortfolioReady(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authUser.isBlocked) {
      setManualPositions([]);
      setIsPortfolioReady(false);
      setSnapshot(null);
      return;
    }

    void loadAccountPositions();
  }, [authUser, loadAccountPositions]);

  useEffect(() => {
    if (!authUser || !isPortfolioReady) {
      return;
    }

    void loadSnapshot();
  }, [authUser, isPortfolioReady, loadSnapshot]);

  const activeTitle = useMemo(() => {
    const item = navItems.find((navItem) => navItem.id === activeView);
    return item ? t[item.labelKey] : t.dashboard;
  }, [activeView, t]);

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("qwg.language", nextLanguage);
  };

  const handlePositionsSave = async (nextPositions: ManualPortfolioPosition[]) => {
    const savedPositions = await repository.savePositions(nextPositions);

    setManualPositions(savedPositions);
    setSnapshot(null);
    setLoadError(null);
    setIsPortfolioReady(true);
    setActiveView("dashboard");
  };

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setIsPortfolioReady(false);
    setAuthError(null);
  };

  const handleLogout = async () => {
    await authClient.logout();
    setAuthUser(null);
    setManualPositions([]);
    setIsPortfolioReady(false);
    setSnapshot(null);
    setLoadError(null);
    setActiveView("setup");
  };

  const handleRefreshAccount = async () => {
    const user = await authClient.getCurrentUser();
    setAuthUser(user);
  };

  const handleBillingAction = async () => {
    setBillingError(null);
    setIsBillingLoading(true);

    try {
      if (hasActiveSubscription && authUser?.billing?.customerId) {
        await authClient.openBillingPortal();
      } else if (hasActiveSubscription) {
        setBillingError("Подписка активна.");
      } else if ((authUser?.balanceUsd ?? 0) >= monthlySubscriptionPriceUsd) {
        await authClient.startBalanceSubscription();
        const user = await authClient.getCurrentUser();
        setAuthUser(user);
        setIsPortfolioReady(false);
        setSnapshot(null);
      } else {
        await authClient.startBillingCheckout();
      }
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Billing action failed.");
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleBalanceSubscription = async () => {
    setBillingError(null);
    setIsBillingLoading(true);

    try {
      await authClient.startBalanceSubscription();
      const user = await authClient.getCurrentUser();
      setAuthUser(user);
      setIsPortfolioReady(false);
      setSnapshot(null);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Balance subscription failed.");
    } finally {
      setIsBillingLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="loading-screen">
        <div className="h-2 w-72 overflow-hidden border border-slate-300 bg-slate-100">
          <div className="h-full w-2/3 bg-navy" />
        </div>
        <div className="mt-4 font-mono text-xs uppercase text-slate-500">{language === "ru" ? "Проверка сессии" : "Checking session"}</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        <AuthScreen authClient={authClient} language={language} onAuthenticated={handleAuthenticated} />
        {authError ? <div className="auth-floating-error">{authError}</div> : null}
      </>
    );
  }

  if (authUser.isBlocked) {
    return <BlockedAccountScreen user={authUser} language={language} onLogout={handleLogout} onRefresh={handleRefreshAccount} />;
  }

  if (!snapshot) {
    return (
      <div className="loading-screen">
        <div className="h-2 w-72 overflow-hidden border border-slate-300 bg-slate-100">
          <div className="h-full w-2/3 bg-navy" />
        </div>
        <div className="mt-4 font-mono text-xs uppercase text-slate-500">{t.loading}</div>
        {loadError ? (
          <div className="mt-4 max-w-xl text-center text-sm text-crimson">
            <div>{language === "ru" ? "Не удалось загрузить портфель." : "Portfolio failed to load."}</div>
            <div className="mt-1 font-mono text-xs">{loadError}</div>
            <button className="secondary-button mt-4" type="button" onClick={() => void (isPortfolioReady ? loadSnapshot() : loadAccountPositions())} disabled={isRefreshing}>
              <TerminalIcon name="refresh" size={16} />
              <span>{isRefreshing ? t.syncing : t.refresh}</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <LogoMark />
          <div className="sidebar-brand-copy">
            <div>Quantum-AI Wealth Guardian</div>
            <span>Trading Floor Terminal</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Terminal navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              aria-label={t[item.labelKey]}
              className={`nav-item ${activeView === item.id ? "nav-item-active" : ""}`}
              title={t[item.labelKey]}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <TerminalIcon name={item.icon} size={18} />
              <span className="nav-label">{t[item.labelKey]}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="language-switch">
            <button className={`language-button ${language === "ru" ? "language-button-active" : ""}`} onClick={() => handleLanguageChange("ru")} type="button">
              RU
            </button>
            <button className={`language-button ${language === "en" ? "language-button-active" : ""}`} onClick={() => handleLanguageChange("en")} type="button">
              EN
            </button>
          </div>
          <div
            className={`sidebar-plan-badge ${hasActiveSubscription ? "sidebar-plan-badge-pro" : "sidebar-plan-badge-free"}`}
            title={
              hasActiveSubscription
                ? authUser.billing?.customerId
                  ? "Stripe PRO active"
                  : "Balance PRO active"
                : `FREE plan: ${freePlanAssetLimit} assets`
            }
          >
            {hasActiveSubscription ? "PRO" : "FREE"}
          </div>
          <button
            aria-label={hasActiveSubscription && authUser.billing?.customerId ? "Manage billing" : "Start billing"}
            className="sidebar-icon-button"
            disabled={isBillingLoading}
            title={
              hasActiveSubscription && !authUser.billing?.customerId
                ? "Balance subscription active"
                : hasActiveSubscription
                  ? "Billing"
                  : authUser.balanceUsd >= monthlySubscriptionPriceUsd
                    ? "Activate PRO from balance"
                    : "Connect billing"
            }
            type="button"
            onClick={() => void handleBillingAction()}
          >
            <TerminalIcon name="credit" size={17} />
          </button>
          <button className="sidebar-icon-button" type="button" onClick={() => void handleLogout()} aria-label={language === "ru" ? "Выйти" : "Logout"} title="Logout">
            <TerminalIcon name="logout" size={17} />
          </button>
          {billingError ? <div className="sidebar-billing-error">{billingError}</div> : null}
          <div className="sidebar-live">
            <span className="live-dot" />
            <span>{t.localServices}</span>
          </div>
          <div className="sidebar-build">{appConfig.buildVersion}</div>
        </div>
      </aside>

      <main className="main-region">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="topbar-title-row">
              <h1>{activeTitle}</h1>
              <Badge tone="navy">SIGMA-3</Badge>
              <Badge tone={hasActiveSubscription ? "success" : "warning"}>
                {hasActiveSubscription ? "PRO" : `FREE ${manualPositions.length}/${freePlanAssetLimit}`}
              </Badge>
              <Badge tone={snapshot.marketData.status === "live" ? "success" : snapshot.marketData.status === "partial" ? "warning" : "danger"}>
                {t.prices}: {snapshot.marketData.status}
              </Badge>
            </div>
            <p>
              {t.lastMarketSync}: <span className="font-mono">{formatDateTime(snapshot.updatedAt)}</span>
              {snapshot.marketData.lastUpdatedAt ? (
                <>
                  {" "}/ {t.providerTick}: <span className="font-mono">{formatDateTime(snapshot.marketData.lastUpdatedAt)}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="topbar-actions">
            <div className="cloud-pill">
              <TerminalIcon name="credit" size={15} />
              <span>{formatCurrencyPrecise(authUser.balanceUsd)}</span>
            </div>
            <div className="cloud-pill">
              <TerminalIcon name="quantum" size={15} />
              <span>QAOA ENGINE</span>
            </div>
            <button className="cloud-pill" type="button" onClick={() => void loadSnapshot()} disabled={isRefreshing}>
              <TerminalIcon name="refresh" size={15} className={isRefreshing ? "spin-icon" : ""} />
              <span>{isRefreshing ? t.syncing : t.refresh}</span>
            </button>
          </div>
        </header>

        <div className="content-region">
          {loadError ? <div className="status-banner status-banner-warning">{loadError}</div> : null}
          {activeView === "dashboard" ? <Dashboard snapshot={snapshot} language={language} /> : null}
          {activeView === "setup" ? (
            <PortfolioSetup
              freeAssetLimit={freePlanAssetLimit}
              isPro={hasActiveSubscription}
              language={language}
              positions={manualPositions}
              onSave={handlePositionsSave}
              onUpgrade={() => void handleBillingAction()}
            />
          ) : null}
          {activeView === "universe" ? <AssetUniverse marketDataProvider={marketDataProvider} language={language} /> : null}
          {activeView === "quantum" ? <QuantumLab snapshot={snapshot} language={language} /> : null}
          {activeView === "execution" ? <ExecutionDesk snapshot={snapshot} /> : null}
          {activeView === "guide" ? <ProductGuide language={language} /> : null}
        </div>
      </main>

      <AdvisorPanel snapshot={snapshot} language={language} />
      <MarketTicker snapshot={snapshot} />
    </div>
  );
};
