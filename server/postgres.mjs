import pg from "pg";

const { Pool } = pg;

const isUnsetConfigValue = (value) => {
  const text = String(value ?? "").trim();

  return !text || text.startsWith("replace-with-") || text.startsWith("your-");
};

const requiredDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

  if (isUnsetConfigValue(databaseUrl)) {
    throw new Error("DATABASE_URL is required. Set it to a PostgreSQL connection string, for example postgresql://guardian:password@127.0.0.1:5432/guardian.");
  }

  return databaseUrl;
};

const runMigrations = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      password_iterations INTEGER,
      password_digest TEXT,
      google_sub TEXT UNIQUE,
      avatar_url TEXT,
      email_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      last_login_at TIMESTAMPTZ,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      account_balance_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
      is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      blocked_reason TEXT,
      blocked_at TIMESTAMPTZ,
      admin_note TEXT,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      stripe_subscription_status TEXT,
      stripe_price_id TEXT,
      stripe_current_period_end TIMESTAMPTZ
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_balance_usd NUMERIC(18, 2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_note TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

    CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS auth_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);

    CREATE TABLE IF NOT EXISTS portfolio_positions (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      coin_gecko_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount NUMERIC(38, 18) NOT NULL CHECK (amount > 0),
      position_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_positions_user_id ON portfolio_positions(user_id);

    CREATE TABLE IF NOT EXISTS quantum_runs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      portfolio_hash TEXT NOT NULL,
      assets_json JSONB NOT NULL,
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quantum_runs_user_portfolio ON quantum_runs(user_id, portfolio_hash, created_at DESC);
  `);
};

export const createPostgresDatabase = async () => {
  const pool = new Pool({
    connectionString: requiredDatabaseUrl(),
    max: Number(process.env.POSTGRES_POOL_SIZE ?? 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  await pool.query("SELECT 1");
  await runMigrations(pool);

  return {
    query: (text, params = []) => pool.query(text, params),
    async transaction(work) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const result = await work({
          query: (text, params = []) => client.query(text, params)
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end()
  };
};
