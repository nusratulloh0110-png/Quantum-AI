import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  provider: "password" | "google" | "unknown";
  avatarUrl?: string | null;
  isAdmin: boolean;
  balanceUsd: number;
  isBlocked: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  positionsCount: number;
  activeSessions: number;
  lastAuthEventAt?: string | null;
}

export interface AdminStats {
  totalAccounts: number;
  blockedAccounts: number;
  adminAccounts: number;
  activeSessions: number;
  totalBalanceUsd: number;
}

interface AccountsResponse {
  accounts?: AdminAccount[];
  stats?: AdminStats;
  error?: string;
}

interface AccountResponse {
  account?: AdminAccount;
  error?: string;
}

export interface UpdateAccountPatch {
  balanceUsd?: number;
  isBlocked?: boolean;
  blockedReason?: string;
  adminNote?: string;
}

const readApiJson = async <T extends { error?: string }>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(data.error || `Admin API returned ${response.status}`);
  }

  return data;
};

export class AdminClient {
  async listAccounts(): Promise<{ accounts: AdminAccount[]; stats: AdminStats }> {
    const response = await fetch(buildLocalApiUrl("/admin/accounts"), {
      credentials: "include"
    });
    const data = await readApiJson<AccountsResponse>(response);

    return {
      accounts: data.accounts ?? [],
      stats:
        data.stats ?? {
          totalAccounts: 0,
          blockedAccounts: 0,
          adminAccounts: 0,
          activeSessions: 0,
          totalBalanceUsd: 0
        }
    };
  }

  async updateAccount(accountId: string, patch: UpdateAccountPatch): Promise<AdminAccount> {
    const response = await fetch(buildLocalApiUrl(`/admin/accounts/${encodeURIComponent(accountId)}`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await readApiJson<AccountResponse>(response);

    if (!data.account) {
      throw new Error("Admin API did not return an account.");
    }

    return data.account;
  }
}
