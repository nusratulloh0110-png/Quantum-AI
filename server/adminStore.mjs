const nowIso = () => new Date().toISOString();

const parseAdminEmails = () =>
  new Set(
    String(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

const toNumber = (value) => {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
};

const cleanText = (value, maxLength) => String(value ?? "").trim().slice(0, maxLength);

const normalizeAccountRow = (row) => {
  if (!row) {
    return null;
  }

  const configuredAdmins = parseAdminEmails();

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    provider: row.google_sub ? "google" : row.password_hash ? "password" : "unknown",
    avatarUrl: row.avatar_url,
    isAdmin: Boolean(row.is_admin) || configuredAdmins.has(String(row.email ?? "").toLowerCase()),
    balanceUsd: toNumber(row.account_balance_usd),
    isBlocked: Boolean(row.is_blocked),
    blockedReason: row.blocked_reason ?? "",
    blockedAt: row.blocked_at,
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    positionsCount: Number(row.positions_count ?? 0),
    activeSessions: Number(row.active_sessions ?? 0),
    lastAuthEventAt: row.last_auth_event_at
  };
};

const accountSelect = `
  SELECT
    users.*,
    COALESCE(position_counts.positions_count, 0)::int AS positions_count,
    COALESCE(session_counts.active_sessions, 0)::int AS active_sessions,
    auth_event_counts.last_auth_event_at
  FROM users
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS positions_count
    FROM portfolio_positions
    GROUP BY user_id
  ) position_counts ON position_counts.user_id = users.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS active_sessions
    FROM auth_sessions
    WHERE revoked_at IS NULL AND expires_at > NOW()
    GROUP BY user_id
  ) session_counts ON session_counts.user_id = users.id
  LEFT JOIN (
    SELECT user_id, MAX(created_at) AS last_auth_event_at
    FROM auth_logs
    GROUP BY user_id
  ) auth_event_counts ON auth_event_counts.user_id = users.id
`;

export const createAdminStore = ({ db }) => {
  if (!db) {
    throw new Error("Admin store requires a PostgreSQL database instance.");
  }

  const getAccount = async (accountId) => {
    const result = await db.query(`${accountSelect} WHERE users.id = $1 LIMIT 1`, [accountId]);

    return normalizeAccountRow(result.rows[0]);
  };

  return {
    async listAccounts() {
      const result = await db.query(`${accountSelect} ORDER BY users.created_at DESC`);
      const accounts = result.rows.map(normalizeAccountRow);
      const totalBalanceUsd = accounts.reduce((sum, account) => sum + account.balanceUsd, 0);

      return {
        accounts,
        stats: {
          totalAccounts: accounts.length,
          blockedAccounts: accounts.filter((account) => account.isBlocked).length,
          adminAccounts: accounts.filter((account) => account.isAdmin).length,
          activeSessions: accounts.reduce((sum, account) => sum + account.activeSessions, 0),
          totalBalanceUsd
        }
      };
    },

    getAccount,

    async updateAccount(accountId, patch) {
      const currentResult = await db.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [accountId]);
      const current = currentResult.rows[0];

      if (!current) {
        const error = new Error("Account was not found.");
        error.statusCode = 404;
        throw error;
      }

      const hasBalance = Object.prototype.hasOwnProperty.call(patch, "balanceUsd");
      const hasBlocked = Object.prototype.hasOwnProperty.call(patch, "isBlocked");
      const hasReason = Object.prototype.hasOwnProperty.call(patch, "blockedReason");
      const hasAdminNote = Object.prototype.hasOwnProperty.call(patch, "adminNote");
      const balanceUsd = hasBalance ? Number(patch.balanceUsd) : toNumber(current.account_balance_usd);

      if (!Number.isFinite(balanceUsd) || balanceUsd < 0 || balanceUsd > 9999999999999999) {
        const error = new Error("Balance must be a positive USD amount.");
        error.statusCode = 400;
        throw error;
      }

      const isBlocked = hasBlocked ? Boolean(patch.isBlocked) : Boolean(current.is_blocked);
      const blockedReason = hasReason ? cleanText(patch.blockedReason, 500) : current.blocked_reason;
      const blockedAt = isBlocked
        ? current.is_blocked && current.blocked_at
          ? current.blocked_at
          : nowIso()
        : null;
      const adminNote = hasAdminNote ? cleanText(patch.adminNote, 1000) : current.admin_note;
      const updatedAt = nowIso();

      await db.query(
        `UPDATE users
         SET account_balance_usd = $1,
             is_blocked = $2,
             blocked_reason = $3,
             blocked_at = $4,
             admin_note = $5,
             updated_at = $6
         WHERE id = $7`,
        [
          balanceUsd.toFixed(2),
          isBlocked,
          isBlocked ? blockedReason : null,
          blockedAt,
          adminNote,
          updatedAt,
          accountId
        ]
      );

      return getAccount(accountId);
    }
  };
};
