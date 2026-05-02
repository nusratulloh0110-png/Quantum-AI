import { useCallback, useEffect, useMemo, useState } from "react";
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
      setLoadError(error instanceof Error ? error.message : "Failed to load portfolio snapshot.");
    } finally {
      setIsRefreshing(false);
    }
  }, [authUser, isPortfolioReady, manualPositions]);

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
    if (!authUser) {
      return;
    }

    let isMounted = true;
    const refreshAccountStatus = async () => {
      try {
        const user = await authClient.getCurrentUser();

        if (isMounted) {
          setAuthUser(user);
        }
      } catch {
        if (isMounted) {
          setAuthUser(null);
        }
      }
    };
    const intervalId = window.setInterval(() => {
      void refreshAccountStatus();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser || !isPortfolioReady) {
      return;
    }

    void loadSnapshot();
    const intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, 60000);

    return () => window.clearInterval(intervalId);
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

  const hasActiveSubscription = ["active", "trialing"].includes(authUser?.billing?.status ?? "");

  const handleBillingAction = async () => {
    setBillingError(null);
    setIsBillingLoading(true);

    try {
      if (hasActiveSubscription || authUser?.billing?.customerId) {
        await authClient.openBillingPortal();
      } else {
        await authClient.startBillingCheckout();
      }
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Billing action failed.");
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
          <button
            aria-label={hasActiveSubscription || authUser.billing?.customerId ? "Manage billing" : "Start billing"}
            className="sidebar-icon-button"
            disabled={isBillingLoading}
            title={hasActiveSubscription || authUser.billing?.customerId ? "Billing" : "Connect billing"}
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
          {activeView === "dashboard" ? <Dashboard snapshot={snapshot} language={language} /> : null}
          {activeView === "setup" ? <PortfolioSetup language={language} positions={manualPositions} onSave={handlePositionsSave} /> : null}
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
