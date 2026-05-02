import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminClient } from "../infrastructure/admin/AdminClient";
import type { AdminAccount, AdminStats } from "../infrastructure/admin/AdminClient";
import { LocalAuthClient } from "../infrastructure/auth/LocalAuthClient";
import type { AuthUser } from "../infrastructure/auth/LocalAuthClient";
import { AuthScreen } from "../ui/views/AuthScreen";
import { Badge } from "../ui/components/Badge";
import { LogoMark, TerminalIcon } from "../ui/components/TerminalIcon";
import { formatCurrencyPrecise, formatDateTime } from "../ui/formatters";
import { appConfig } from "../app/config";

const authClient = new LocalAuthClient();
const adminClient = new AdminClient();

const emptyStats: AdminStats = {
  totalAccounts: 0,
  blockedAccounts: 0,
  adminAccounts: 0,
  activeSessions: 0,
  totalBalanceUsd: 0
};

interface AccountDraft {
  balanceUsd: string;
  isBlocked: boolean;
  blockedReason: string;
  adminNote: string;
  newPassword: string;
}

const toDraft = (account: AdminAccount): AccountDraft => ({
  balanceUsd: account.balanceUsd.toFixed(2),
  isBlocked: account.isBlocked,
  blockedReason: account.blockedReason ?? "",
  adminNote: account.adminNote ?? "",
  newPassword: ""
});

const formatOptionalDate = (value?: string | null) => (value ? formatDateTime(value) : "—");

const getInitials = (account: Pick<AdminAccount, "email" | "name">) => {
  const source = account.name || account.email;
  const parts = source
    .split(/[.\s@_-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export const AdminApp = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [query, setQuery] = useState("");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setError(null);

    try {
      const result = await adminClient.listAccounts();
      setAccounts(result.accounts);
      setStats(result.stats);
      setSelectedId((currentId) => currentId ?? result.accounts[0]?.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить аккаунты.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    authClient
      .getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setAuthUser(user);
        }
      })
      .catch((nextError) => {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError.message : "Не удалось проверить сессию.");
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

  useEffect(() => {
    if (authUser?.isAdmin) {
      void loadAccounts();
    }
  }, [authUser, loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return accounts;
    }

    return accounts.filter((account) =>
      [account.email, account.name, account.provider, account.isBlocked ? "blocked" : "active"]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [accounts, query]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? filteredAccounts[0] ?? null,
    [accounts, filteredAccounts, selectedId]
  );

  useEffect(() => {
    if (selectedAccount) {
      setDraft(toDraft(selectedAccount));
      setSelectedId(selectedAccount.id);
    } else {
      setDraft(null);
    }
  }, [selectedAccount?.id]);

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setError(null);
  };

  const handleLogout = async () => {
    await authClient.logout();
    setAuthUser(null);
    setAccounts([]);
    setSelectedId(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!selectedAccount || !draft) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await adminClient.updateAccount(selectedAccount.id, {
        balanceUsd: Number(draft.balanceUsd),
        isBlocked: draft.isBlocked,
        blockedReason: draft.blockedReason,
        adminNote: draft.adminNote,
        newPassword: draft.newPassword.trim() || undefined
      });
      setAccounts((currentAccounts) =>
        currentAccounts.map((account) => (account.id === updated.id ? updated : account))
      );
      setDraft(toDraft(updated));
      setNotice(draft.newPassword.trim() ? "Аккаунт и пароль обновлены." : "Аккаунт обновлен.");
      void loadAccounts();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось сохранить аккаунт.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="loading-screen">
        <TerminalIcon name="refresh" className="auth-spinner text-navy" size={24} />
        <div className="mt-4 font-mono text-xs uppercase text-slate-500">Проверка админ-сессии</div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen authClient={authClient} language="ru" onAuthenticated={handleAuthenticated} />;
  }

  if (!authUser.isAdmin) {
    return (
      <main className="admin-access-shell">
        <section className="admin-access-panel">
          <LogoMark />
          <h1>Нет доступа</h1>
          <p>{authUser.email}</p>
          <button className="secondary-button" type="button" onClick={() => void handleLogout()}>
            <TerminalIcon name="logout" size={17} />
            <span>Выйти</span>
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <LogoMark />
          <div>
            <div className="text-sm font-medium text-white">Guardian Admin</div>
            <div className="mt-1 font-mono text-[11px] text-slate-400">admin domain console</div>
          </div>
        </div>

        <div className="admin-search">
          <TerminalIcon name="search" size={16} />
          <input value={query} placeholder="Поиск аккаунта" onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="admin-account-list">
          {filteredAccounts.map((account) => (
            <button
              key={account.id}
              className={`admin-account-row ${selectedAccount?.id === account.id ? "admin-account-row-active" : ""}`}
              type="button"
              onClick={() => {
                setSelectedId(account.id);
                setDraft(toDraft(account));
              }}
            >
              <span className="admin-account-avatar">{getInitials(account)}</span>
              <span className="admin-account-copy">
                <strong>{account.email}</strong>
                <small>{formatCurrencyPrecise(account.balanceUsd)}</small>
              </span>
              <TerminalIcon name={account.isBlocked ? "ban" : "check"} size={15} />
            </button>
          ))}
        </div>

        <div className="sidebar-status">
          <div className="sidebar-user">
            <div>
              <span>Администратор</span>
              <strong>{authUser.email}</strong>
            </div>
            <button className="sidebar-logout" type="button" onClick={() => void handleLogout()} aria-label="Выйти">
              <TerminalIcon name="logout" size={15} />
            </button>
          </div>
          <div className="mt-3 font-mono text-[11px] text-slate-500">{appConfig.buildVersion}</div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar admin-topbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1>Аккаунты</h1>
              <Badge tone="navy">admin.{window.location.hostname.replace(/^admin\./, "")}</Badge>
              <Badge tone={stats.blockedAccounts > 0 ? "warning" : "success"}>{stats.blockedAccounts} blocked</Badge>
            </div>
            <p>
              Всего: <span className="font-mono">{stats.totalAccounts}</span> / Активные сессии:{" "}
              <span className="font-mono">{stats.activeSessions}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <button className="cloud-pill" type="button" onClick={() => void loadAccounts()} disabled={isLoadingAccounts}>
              <TerminalIcon name="refresh" className={isLoadingAccounts ? "spin-icon" : ""} size={15} />
              <span>{isLoadingAccounts ? "Обновление" : "Обновить"}</span>
            </button>
          </div>
        </header>

        <div className="content-region admin-content">
          <div className="grid gap-4 xl:grid-cols-4">
            <section className="metric-card">
              <div className="metric-card-label">Аккаунты</div>
              <div className="metric-card-value">{stats.totalAccounts}</div>
              <div className="metric-card-detail">Админов: {stats.adminAccounts}</div>
              <TerminalIcon name="users" className="mt-4 text-navy" size={20} />
            </section>
            <section className="metric-card">
              <div className="metric-card-label">Баланс</div>
              <div className="metric-card-value">{formatCurrencyPrecise(stats.totalBalanceUsd)}</div>
              <div className="metric-card-detail">Суммарный баланс аккаунтов</div>
              <TerminalIcon name="dollar" className="mt-4 text-emeraldStrict" size={20} />
            </section>
            <section className="metric-card">
              <div className="metric-card-label">Блокировки</div>
              <div className="metric-card-value">{stats.blockedAccounts}</div>
              <div className="metric-card-detail">Пользователь увидит статус в аккаунте</div>
              <TerminalIcon name="ban" className="mt-4 text-crimson" size={20} />
            </section>
            <section className="metric-card">
              <div className="metric-card-label">Сессии</div>
              <div className="metric-card-value">{stats.activeSessions}</div>
              <div className="metric-card-detail">Неистекшие сессии</div>
              <TerminalIcon name="user" className="mt-4 text-navy" size={20} />
            </section>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}
          {notice ? <div className="admin-notice">{notice}</div> : null}

          <div className="admin-workspace">
            <section className="panel admin-table-panel">
              <div className="panel-header">
                <h2>Все аккаунты</h2>
                <span>{filteredAccounts.length} shown</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table admin-data-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Provider</th>
                      <th>Positions</th>
                      <th>Sessions</th>
                      <th>Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className={selectedAccount?.id === account.id ? "admin-table-row-active" : ""}
                        onClick={() => {
                          setSelectedId(account.id);
                          setDraft(toDraft(account));
                        }}
                      >
                        <td>
                          <div className="font-medium text-slate-950">{account.email}</div>
                          <div className="text-xs text-slate-500">{account.name}</div>
                        </td>
                        <td className="font-mono">{formatCurrencyPrecise(account.balanceUsd)}</td>
                        <td>
                          <Badge tone={account.isBlocked ? "danger" : "success"}>{account.isBlocked ? "Blocked" : "Active"}</Badge>
                        </td>
                        <td>{account.provider}</td>
                        <td className="font-mono">{account.positionsCount}</td>
                        <td className="font-mono">{account.activeSessions}</td>
                        <td className="font-mono">{formatOptionalDate(account.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedAccount && draft ? (
              <section className="panel admin-editor">
                <div className="panel-header">
                  <h2>Управление аккаунтом</h2>
                  <Badge tone={selectedAccount.isAdmin ? "navy" : selectedAccount.isBlocked ? "danger" : "success"}>
                    {selectedAccount.isAdmin ? "Admin" : selectedAccount.isBlocked ? "Blocked" : "Active"}
                  </Badge>
                </div>

                <div className="admin-profile">
                  <div className="admin-profile-avatar">{getInitials(selectedAccount)}</div>
                  <div>
                    <h3>{selectedAccount.email}</h3>
                    <p>{selectedAccount.name}</p>
                  </div>
                </div>

                <label className="auth-field">
                  <span>Баланс, USD</span>
                  <div>
                    <TerminalIcon name="dollar" size={16} />
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={draft.balanceUsd}
                      onChange={(event) => setDraft((current) => (current ? { ...current, balanceUsd: event.target.value } : current))}
                    />
                  </div>
                </label>

                <label className="admin-toggle-row">
                  <input
                    checked={draft.isBlocked}
                    type="checkbox"
                    onChange={(event) => setDraft((current) => (current ? { ...current, isBlocked: event.target.checked } : current))}
                  />
                  <span>
                    <strong>Заблокировать аккаунт</strong>
                    <small>{draft.isBlocked ? "Доступ к рабочим API будет закрыт" : "Аккаунт активен"}</small>
                  </span>
                </label>

                <label className="admin-textarea-field">
                  <span>Причина блокировки</span>
                  <textarea
                    rows={4}
                    value={draft.blockedReason}
                    onChange={(event) => setDraft((current) => (current ? { ...current, blockedReason: event.target.value } : current))}
                  />
                </label>

                <label className="admin-textarea-field">
                  <span>Заметка админа</span>
                  <textarea
                    rows={4}
                    value={draft.adminNote}
                    onChange={(event) => setDraft((current) => (current ? { ...current, adminNote: event.target.value } : current))}
                  />
                </label>

                <label className="auth-field">
                  <span>Новый пароль</span>
                  <div>
                    <TerminalIcon name="key" size={16} />
                    <input
                      autoComplete="new-password"
                      minLength={10}
                      type="password"
                      value={draft.newPassword}
                      onChange={(event) => setDraft((current) => (current ? { ...current, newPassword: event.target.value } : current))}
                    />
                  </div>
                  <small>Оставьте пустым, если пароль менять не нужно. Минимум 10 символов, буквы и цифры.</small>
                </label>

                <dl className="admin-account-meta">
                  <div>
                    <dt>Создан</dt>
                    <dd>{formatOptionalDate(selectedAccount.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Последнее событие</dt>
                    <dd>{formatOptionalDate(selectedAccount.lastAuthEventAt)}</dd>
                  </div>
                  <div>
                    <dt>Блокировка</dt>
                    <dd>{formatOptionalDate(selectedAccount.blockedAt)}</dd>
                  </div>
                </dl>

                <button className="primary-button admin-save-button" type="button" onClick={() => void handleSave()} disabled={isSaving}>
                  <TerminalIcon name={isSaving ? "refresh" : "save"} className={isSaving ? "auth-spinner" : ""} size={17} />
                  <span>{isSaving ? "Сохранение" : "Сохранить"}</span>
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};
