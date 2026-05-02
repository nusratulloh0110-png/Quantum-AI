import {
  createHash,
  createPublicKey,
  createVerify,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const SESSION_COOKIE_NAME = "qwg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";

const jwksCache = {
  expiresAt: 0,
  keys: []
};

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const nowIso = () => new Date().toISOString();

const addSeconds = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();

const base64Url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const decodeBase64UrlJson = (value) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
};

const randomToken = (bytes = 32) => base64Url(randomBytes(bytes));

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

const cleanName = (name) => String(name ?? "").trim().slice(0, 100);

const parseAdminEmails = () =>
  new Set(
    String(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );

const parseAccountBalance = (value) => {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
};

const isUnsetConfigValue = (value) => {
  const text = String(value ?? "").trim();

  return !text || text.startsWith("replace-with-") || text.startsWith("your-");
};

const getHeader = (request, name) => {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const getIpAddress = (request) => {
  const forwardedFor = getHeader(request, "x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.socket?.remoteAddress ?? "";
};

const parseCookies = (request) => {
  const header = getHeader(request, "cookie");
  const cookies = new Map();

  for (const part of header.split(";")) {
    const equalsIndex = part.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = part.slice(0, equalsIndex).trim();
    const value = part.slice(equalsIndex + 1).trim();

    if (key) {
      cookies.set(key, decodeURIComponent(value));
    }
  }

  return cookies;
};

const buildCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const isSecureRequest = (request) => {
  const forwardedProto = getHeader(request, "x-forwarded-proto");

  return forwardedProto === "https" || request.socket?.encrypted === true;
};

const validatePassword = (password) => {
  const text = String(password ?? "");

  if (text.length < 10) {
    throw new AuthError(400, "Password must be at least 10 characters long.");
  }

  if (!/[a-z]/i.test(text) || !/[0-9]/.test(text)) {
    throw new AuthError(400, "Password must include letters and numbers.");
  }

  if (text.length > 256) {
    throw new AuthError(400, "Password is too long.");
  }

  return text;
};

const hashPassword = (password) => {
  const salt = randomBytes(32);
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST);

  return {
    password_hash: hash.toString("hex"),
    password_salt: salt.toString("hex"),
    password_iterations: PASSWORD_ITERATIONS,
    password_digest: PASSWORD_DIGEST
  };
};

const verifyPassword = (password, user) => {
  if (!user?.password_hash || !user?.password_salt) {
    return false;
  }

  const expected = Buffer.from(user.password_hash, "hex");
  const actual = pbkdf2Sync(
    String(password ?? ""),
    Buffer.from(user.password_salt, "hex"),
    Number(user.password_iterations ?? PASSWORD_ITERATIONS),
    expected.length,
    user.password_digest ?? PASSWORD_DIGEST
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const sanitizeUser = (row) => {
  if (!row) {
    return null;
  }

  const adminEmails = parseAdminEmails();

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    provider: row.google_sub ? "google" : row.password_hash ? "password" : "unknown",
    isAdmin: Boolean(row.is_admin) || adminEmails.has(normalizeEmail(row.email)),
    balanceUsd: parseAccountBalance(row.account_balance_usd),
    isBlocked: Boolean(row.is_blocked),
    blockedReason: row.blocked_reason ?? "",
    blockedAt: row.blocked_at ?? null,
    billing: {
      customerId: row.stripe_customer_id ?? null,
      subscriptionId: row.stripe_subscription_id ?? null,
      status: row.stripe_subscription_status ?? null,
      priceId: row.stripe_price_id ?? null,
      currentPeriodEnd: row.stripe_current_period_end ?? null
    },
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
};

const assertGoogleConfig = ({ googleClientId, googleClientSecret }) => {
  if (isUnsetConfigValue(googleClientId) || isUnsetConfigValue(googleClientSecret)) {
    throw new AuthError(503, "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
};

const fetchJsonWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data.error_description || data.error || `HTTP ${response.status}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
};

const getGoogleJwks = async () => {
  if (jwksCache.keys.length && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const data = await fetchJsonWithTimeout(GOOGLE_JWKS_ENDPOINT);

  jwksCache.keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache.expiresAt = Date.now() + 60 * 60 * 1000;

  return jwksCache.keys;
};

const verifyGoogleIdToken = async (idToken, googleClientId) => {
  const parts = String(idToken ?? "").split(".");

  if (parts.length !== 3) {
    throw new AuthError(401, "Google returned an invalid ID token.");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeBase64UrlJson(headerPart);
  const payload = decodeBase64UrlJson(payloadPart);

  if (header.alg !== "RS256" || !header.kid) {
    throw new AuthError(401, "Google ID token uses an unsupported signature.");
  }

  const keys = await getGoogleJwks();
  const jwk = keys.find((key) => key.kid === header.kid);

  if (!jwk) {
    throw new AuthError(401, "Google signing key was not found.");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();

  const signature = Buffer.from(signaturePart.replaceAll("-", "+").replaceAll("_", "/"), "base64");
  const verified = verifier.verify(createPublicKey({ key: jwk, format: "jwk" }), signature);

  if (!verified) {
    throw new AuthError(401, "Google ID token signature is invalid.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const validIssuer = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";

  if (!validIssuer || payload.aud !== googleClientId || Number(payload.exp ?? 0) <= nowSeconds) {
    throw new AuthError(401, "Google ID token claims are invalid.");
  }

  if (!payload.email || payload.email_verified !== true) {
    throw new AuthError(401, "Google account email is not verified.");
  }

  return payload;
};

const createLoginLimiter = () => {
  const buckets = new Map();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 8;

  const keyFor = (request, email) => `${getIpAddress(request)}:${email}`;

  return {
    assertAllowed(request, email) {
      const key = keyFor(request, email);
      const bucket = buckets.get(key);

      if (bucket && bucket.expiresAt > Date.now() && bucket.count >= maxAttempts) {
        throw new AuthError(429, "Too many login attempts. Try again later.");
      }
    },
    recordFailure(request, email) {
      const key = keyFor(request, email);
      const existing = buckets.get(key);

      if (!existing || existing.expiresAt <= Date.now()) {
        buckets.set(key, { count: 1, expiresAt: Date.now() + windowMs });
        return;
      }

      existing.count += 1;
    },
    clear(request, email) {
      buckets.delete(keyFor(request, email));
    }
  };
};

export const createAuthService = (config = {}) => {
  const db = config.db;

  if (!db) {
    throw new Error("Auth service requires a PostgreSQL database instance.");
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const appOrigin = process.env.APP_ORIGIN ?? `http://127.0.0.1:${config.port ?? 8787}`;
  const googleRedirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `http://127.0.0.1:${config.port ?? 8787}/api/auth/google/callback`;
  const limiter = createLoginLimiter();
  const isGoogleConfigured = () => !isUnsetConfigValue(googleClientId) && !isUnsetConfigValue(googleClientSecret);

  const logAuthEvent = async ({ request, userId = null, email = null, eventType, success, message = "" }) => {
    await db.query(
      `INSERT INTO auth_logs (user_id, event_type, email, ip_address, user_agent, success, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        eventType,
        email,
        request ? getIpAddress(request) : "",
        request ? getHeader(request, "user-agent").slice(0, 300) : "",
        Boolean(success),
        message.slice(0, 500),
        nowIso()
      ]
    );
  };

  const findUserByEmail = async (email) => {
    const result = await db.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);

    return result.rows[0] ?? null;
  };

  const findUserByGoogleSub = async (googleSub) => {
    const result = await db.query("SELECT * FROM users WHERE google_sub = $1 LIMIT 1", [googleSub]);

    return result.rows[0] ?? null;
  };

  const createSession = async (request, userId) => {
    const token = randomToken(48);
    const createdAt = nowIso();

    await db.query(
      `INSERT INTO auth_sessions (id, user_id, token_hash, ip_address, user_agent, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomToken(16),
        userId,
        sha256(token),
        getIpAddress(request),
        getHeader(request, "user-agent").slice(0, 300),
        createdAt,
        addSeconds(SESSION_TTL_SECONDS)
      ]
    );

    return token;
  };

  const buildSessionCookie = (request, token) =>
    buildCookie(SESSION_COOKIE_NAME, token, {
      maxAge: SESSION_TTL_SECONDS,
      secure: isSecureRequest(request)
    });

  const clearSessionCookie = () =>
    buildCookie(SESSION_COOKIE_NAME, "", {
      maxAge: 0
    });

  const getSession = async (request) => {
    const token = parseCookies(request).get(SESSION_COOKIE_NAME);

    if (!token) {
      return null;
    }

    const result = await db.query(
      `SELECT users.*, auth_sessions.id AS session_id, auth_sessions.expires_at, auth_sessions.revoked_at
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token_hash = $1
       LIMIT 1`,
      [sha256(token)]
    );
    const row = result.rows[0];

    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }

    return {
      sessionId: row.session_id,
      user: sanitizeUser(row)
    };
  };

  return {
    cookieName: SESSION_COOKIE_NAME,
    isGoogleConfigured,
    getSession,
    clearSessionCookie,
    async register(request, body) {
      const email = normalizeEmail(body?.email);
      const password = validatePassword(body?.password);
      const name = cleanName(body?.name) || email.split("@")[0];

      if (!isValidEmail(email)) {
        throw new AuthError(400, "Enter a valid email address.");
      }

      const existing = await findUserByEmail(email);

      if (existing) {
        await logAuthEvent({ request, email, eventType: "register_failed", success: false, message: "email_exists" });
        throw new AuthError(409, "User with this email already exists.");
      }

      const createdAt = nowIso();
      const id = randomToken(16);
      const passwordFields = hashPassword(password);

      await db.query(
        `INSERT INTO users (
          id, email, name, password_hash, password_salt, password_iterations, password_digest,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          email,
          name,
          passwordFields.password_hash,
          passwordFields.password_salt,
          passwordFields.password_iterations,
          passwordFields.password_digest,
          createdAt,
          createdAt
        ]
      );

      const token = await createSession(request, id);
      await db.query("UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3", [createdAt, createdAt, id]);
      await logAuthEvent({ request, userId: id, email, eventType: "register_success", success: true });

      return {
        user: sanitizeUser(await findUserByEmail(email)),
        sessionCookie: buildSessionCookie(request, token)
      };
    },
    async login(request, body) {
      const email = normalizeEmail(body?.email);

      if (!isValidEmail(email)) {
        throw new AuthError(400, "Enter a valid email address.");
      }

      limiter.assertAllowed(request, email);
      const user = await findUserByEmail(email);

      if (!user || !verifyPassword(body?.password, user)) {
        limiter.recordFailure(request, email);
        await logAuthEvent({
          request,
          userId: user?.id ?? null,
          email,
          eventType: "login_failed",
          success: false,
          message: user?.password_hash ? "bad_credentials" : "password_login_unavailable"
        });
        throw new AuthError(401, "Invalid email or password.");
      }

      limiter.clear(request, email);
      const token = await createSession(request, user.id);
      const loginAt = nowIso();

      await db.query("UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3", [loginAt, loginAt, user.id]);
      await logAuthEvent({ request, userId: user.id, email, eventType: "login_success", success: true });

      return {
        user: sanitizeUser(await findUserByEmail(email)),
        sessionCookie: buildSessionCookie(request, token)
      };
    },
    async logout(request) {
      const token = parseCookies(request).get(SESSION_COOKIE_NAME);

      if (token) {
        const session = await getSession(request);
        await db.query("UPDATE auth_sessions SET revoked_at = $1 WHERE token_hash = $2", [nowIso(), sha256(token)]);
        await logAuthEvent({
          request,
          userId: session?.user?.id ?? null,
          email: session?.user?.email ?? null,
          eventType: "logout",
          success: true
        });
      }

      return {
        sessionCookie: clearSessionCookie()
      };
    },
    async beginGoogleOAuth(request) {
      assertGoogleConfig({ googleClientId, googleClientSecret });

      const state = randomToken(32);
      const codeVerifier = randomToken(48);
      const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());
      const createdAt = nowIso();

      await db.query(
        `INSERT INTO oauth_states (state_hash, code_verifier, redirect_uri, ip_address, user_agent, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sha256(state),
          codeVerifier,
          googleRedirectUri,
          getIpAddress(request),
          getHeader(request, "user-agent").slice(0, 300),
          createdAt,
          addSeconds(OAUTH_STATE_TTL_SECONDS)
        ]
      );

      const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", googleClientId);
      url.searchParams.set("redirect_uri", googleRedirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("prompt", "select_account");

      return url.toString();
    },
    async completeGoogleOAuth(request, query) {
      assertGoogleConfig({ googleClientId, googleClientSecret });

      const state = String(query.get("state") ?? "");
      const code = String(query.get("code") ?? "");
      const stateHash = sha256(state);
      const stateResult = await db.query("SELECT * FROM oauth_states WHERE state_hash = $1 LIMIT 1", [stateHash]);
      const stateRow = stateResult.rows[0];

      if (!state || !code || !stateRow || stateRow.used_at || new Date(stateRow.expires_at).getTime() <= Date.now()) {
        await logAuthEvent({ request, eventType: "google_login_failed", success: false, message: "invalid_state" });
        throw new AuthError(401, "Google sign-in state is invalid or expired.");
      }

      await db.query("UPDATE oauth_states SET used_at = $1 WHERE state_hash = $2", [nowIso(), stateHash]);

      const tokenData = await fetchJsonWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          code_verifier: stateRow.code_verifier,
          grant_type: "authorization_code",
          redirect_uri: stateRow.redirect_uri
        })
      });

      const claims = await verifyGoogleIdToken(tokenData.id_token, googleClientId);
      const email = normalizeEmail(claims.email);
      const loginAt = nowIso();
      let user = await findUserByGoogleSub(claims.sub);

      if (!user) {
        user = await findUserByEmail(email);

        if (user?.google_sub && user.google_sub !== claims.sub) {
          await logAuthEvent({
            request,
            userId: user.id,
            email,
            eventType: "google_login_failed",
            success: false,
            message: "google_subject_mismatch"
          });
          throw new AuthError(409, "This email is already linked to a different Google account.");
        }

        if (user) {
          await db.query(
            `UPDATE users
             SET google_sub = $1, avatar_url = $2, email_verified_at = $3, name = COALESCE(NULLIF(name, ''), $4), updated_at = $5
             WHERE id = $6`,
            [claims.sub, claims.picture ?? null, loginAt, cleanName(claims.name) || email.split("@")[0], loginAt, user.id]
          );
        } else {
          const userId = randomToken(16);

          await db.query(
            `INSERT INTO users (
              id, email, name, google_sub, avatar_url, email_verified_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId,
              email,
              cleanName(claims.name) || email.split("@")[0],
              claims.sub,
              claims.picture ?? null,
              loginAt,
              loginAt,
              loginAt
            ]
          );
        }
      }

      const userResult = await db.query(
        `SELECT * FROM users
         WHERE google_sub = $1 OR email = $2
         ORDER BY CASE WHEN google_sub = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [claims.sub, email]
      );
      user = userResult.rows[0];
      const token = await createSession(request, user.id);

      await db.query("UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3", [loginAt, loginAt, user.id]);
      await logAuthEvent({ request, userId: user.id, email, eventType: "google_login_success", success: true });

      return {
        user: sanitizeUser(await findUserByEmail(email)),
        sessionCookie: buildSessionCookie(request, token),
        redirectTo: appOrigin
      };
    }
  };
};
