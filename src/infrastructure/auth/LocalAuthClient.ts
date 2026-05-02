import { buildLocalApiUrl } from "../http/buildLocalApiUrl";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  provider: "password" | "google" | "unknown";
  isAdmin: boolean;
  balanceUsd: number;
  isBlocked: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
  billing?: {
    customerId?: string | null;
    subscriptionId?: string | null;
    status?: string | null;
    priceId?: string | null;
    currentPeriodEnd?: string | null;
  };
  createdAt: string;
  lastLoginAt?: string | null;
}

interface AuthResponse {
  user: AuthUser | null;
  error?: string;
}

interface AuthConfigResponse {
  googleEnabled: boolean;
  stripeBillingEnabled?: boolean;
  error?: string;
}

const readAuthResponse = async (response: Response): Promise<AuthResponse> => {
  const data = (await response.json().catch(() => ({}))) as AuthResponse;

  if (!response.ok) {
    throw new Error(data.error || `Auth API returned ${response.status}`);
  }

  return data;
};

export class LocalAuthClient {
  async getConfig(): Promise<AuthConfigResponse> {
    const response = await fetch(buildLocalApiUrl("/auth/config"), {
      credentials: "include"
    });
    const data = (await response.json().catch(() => ({}))) as AuthConfigResponse;

    if (!response.ok) {
      throw new Error(data.error || `Auth config API returned ${response.status}`);
    }

    return data;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const response = await fetch(buildLocalApiUrl("/auth/me"), {
      credentials: "include"
    });
    const data = await readAuthResponse(response);

    return data.user;
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await fetch(buildLocalApiUrl("/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await readAuthResponse(response);

    if (!data.user) {
      throw new Error("Auth API did not return a user.");
    }

    return data.user;
  }

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const response = await fetch(buildLocalApiUrl("/auth/register"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await readAuthResponse(response);

    if (!data.user) {
      throw new Error("Auth API did not return a user.");
    }

    return data.user;
  }

  async logout(): Promise<void> {
    await fetch(buildLocalApiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include"
    });
  }

  startGoogleLogin(): void {
    window.location.assign(buildLocalApiUrl("/auth/google"));
  }

  async startBillingCheckout(): Promise<void> {
    const response = await fetch(buildLocalApiUrl("/billing/checkout"), {
      method: "POST",
      credentials: "include"
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      throw new Error(data.error || `Billing API returned ${response.status}`);
    }

    window.location.assign(data.url);
  }

  async openBillingPortal(): Promise<void> {
    const response = await fetch(buildLocalApiUrl("/billing/portal"), {
      method: "POST",
      credentials: "include"
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      throw new Error(data.error || `Billing API returned ${response.status}`);
    }

    window.location.assign(data.url);
  }
}
