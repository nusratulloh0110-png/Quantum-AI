import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { URL } from "node:url";
import { createAuthService } from "./auth.mjs";
import { createAdminStore } from "./adminStore.mjs";
import { createPostgresDatabase } from "./postgres.mjs";
import { createPortfolioStore } from "./portfolioStore.mjs";
import { createQuantumRunStore } from "./quantumRunStore.mjs";
import { createStripeBillingService } from "./stripeBilling.mjs";
import { loadLocalEnv } from "./env.mjs";
import { buildPortfolioSnapshot } from "./portfolioEngine.mjs";
import { simulateLocalQaoa } from "./localQuantumOptimizer.mjs";

loadLocalEnv();

const port = Number(process.env.LOCAL_API_PORT ?? process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const coingeckoBaseUrl = process.env.COINGECKO_API_BASE_URL ?? "https://api.coingecko.com/api/v3";
const coingeckoKey = process.env.COINGECKO_DEMO_API_KEY ?? "";
const groqKey = process.env.GROQ_API_KEY ?? "";
const groqModel = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const priceCache = new Map();
const searchCache = new Map();
const staticRoot = resolve(process.cwd(), "dist");
const maxJsonBodyBytes = 1_000_000;
const db = await createPostgresDatabase();
const authService = createAuthService({ port, db });
const adminStore = createAdminStore({ db });
const portfolioStore = createPortfolioStore({ db });
const quantumRunStore = createQuantumRunStore({ db });
const stripeBillingService = createStripeBillingService({ db, port });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN ?? process.env.APP_ORIGIN ?? "http://127.0.0.1:5173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const sendJson = (response, statusCode, payload, extraHeaders = {}) => {
  response.writeHead(statusCode, { ...jsonHeaders, ...extraHeaders });
  response.end(JSON.stringify(payload));
};

const sendRedirect = (response, location, extraHeaders = {}) => {
  response.writeHead(302, { Location: location, ...extraHeaders });
  response.end();
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sendStaticFile = (response, filePath) => {
  const extension = extname(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
};

const readJsonBody = async (request) => {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;

    if (receivedBytes > maxJsonBodyBytes) {
      throw new HttpError(413, "JSON body is too large.");
    }

    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
};

const readRawBody = async (request) => {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;

    if (receivedBytes > maxJsonBodyBytes) {
      throw new HttpError(413, "Request body is too large.");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

const isAdminHost = (requestUrl) => {
  const hostName = requestUrl.hostname.toLowerCase();

  return hostName === "admin" || hostName.startsWith("admin.") || requestUrl.pathname === "/admin" || requestUrl.pathname.startsWith("/admin/");
};

const isBlockedAccountAllowedPath = (pathname) =>
  pathname === "/api/auth/me" || pathname === "/api/auth/logout" || pathname === "/api/account/status";

const buildCoinGeckoUrl = (path, params = {}) => {
  const url = new URL(`${coingeckoBaseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  if (coingeckoKey) {
    url.searchParams.set("x_cg_demo_api_key", coingeckoKey);
  }

  return url;
};

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 180)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const getCoinPrices = async (ids, vsCurrency = "usd") => {
  const requestedIds = ids.map((id) => String(id ?? "").trim()).filter(Boolean);

  if (!requestedIds.length) {
    return [];
  }

  const uniqueIds = [...new Set(requestedIds)];
  const cacheKey = `${vsCurrency}:${[...uniqueIds].sort().join(",")}`;
  const buildPrice = (id, data, source) => ({
    id,
    priceUsd: typeof data?.[id]?.[vsCurrency] === "number" ? data[id][vsCurrency] : null,
    dailyChangePct: typeof data?.[id]?.[`${vsCurrency}_24h_change`] === "number" ? data[id][`${vsCurrency}_24h_change`] : null,
    marketCapUsd: typeof data?.[id]?.[`${vsCurrency}_market_cap`] === "number" ? data[id][`${vsCurrency}_market_cap`] : null,
    lastUpdatedAt: data?.[id]?.last_updated_at ? new Date(data[id].last_updated_at * 1000).toISOString() : null,
    source
  });
  const expandRequestedPrices = (prices, source) => {
    const priceMap = new Map(prices.map((price) => [price.id, price]));

    return requestedIds.map((id) => {
      const price = priceMap.get(id);

      return price
        ? { ...price, source }
        : { id, priceUsd: null, dailyChangePct: null, marketCapUsd: null, lastUpdatedAt: null, source: "fallback" };
    });
  };

  try {
    const data = await fetchJson(
      buildCoinGeckoUrl("/simple/price", {
        ids: uniqueIds.join(","),
        vs_currencies: vsCurrency,
        include_24hr_change: "true",
        include_market_cap: "true",
        include_last_updated_at: "true"
      })
    );
    const prices = uniqueIds.map((id) => buildPrice(id, data, "coingecko"));

    priceCache.set(cacheKey, prices);
    return expandRequestedPrices(prices, "coingecko");
  } catch (error) {
    const cachedPrices = priceCache.get(cacheKey);

    if (cachedPrices) {
      return expandRequestedPrices(cachedPrices, "coingecko-cache");
    }

    throw error;
  }
};

const searchCoins = async (query) => {
  const cloneResults = (results) => results.map((result) => ({ ...result }));

  if (!query) {
    const cacheKey = "top:50";

    try {
      const data = await fetchJson(
        buildCoinGeckoUrl("/coins/markets", {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: "50",
          page: "1",
          sparkline: "false",
          price_change_percentage: "24h"
        })
      );
      const coins = data.map((coin) => ({
        id: coin.id,
        symbol: coin.symbol?.toUpperCase(),
        name: coin.name,
        marketCapRank: coin.market_cap_rank,
        priceUsd: coin.current_price,
        dailyChangePct: coin.price_change_percentage_24h,
        image: coin.image,
        source: "coingecko"
      }));

      searchCache.set(cacheKey, coins);
      return coins;
    } catch (error) {
      const cachedCoins = searchCache.get(cacheKey);

      if (cachedCoins) {
        return cloneResults(cachedCoins);
      }

      throw error;
    }
  }

  const cacheKey = `query:${query.toLowerCase()}`;

  try {
    const data = await fetchJson(buildCoinGeckoUrl("/search", { query }));
    const coins = (data.coins ?? []).slice(0, 12);
    const prices = await getCoinPrices(coins.map((coin) => coin.id));
    const priceMap = new Map(prices.map((price) => [price.id, price]));

    const results = coins.map((coin) => {
      const price = priceMap.get(coin.id);

      return {
        id: coin.id,
        symbol: coin.symbol?.toUpperCase(),
        name: coin.name,
        marketCapRank: coin.market_cap_rank,
        priceUsd: price?.priceUsd ?? null,
        dailyChangePct: price?.dailyChangePct ?? null,
        image: coin.large || coin.thumb,
        source: "coingecko"
      };
    });

    searchCache.set(cacheKey, results);
    return results;
  } catch (error) {
    const cachedResults = searchCache.get(cacheKey);

    if (cachedResults) {
      return cloneResults(cachedResults);
    }

    throw error;
  }
};

const buildLocalAdvisorResponse = (question, snapshot, reason = "Groq provider is unavailable.", language = "en") => {
  const recommendations = snapshot?.recommendations ?? [];
  const largestDelta = [...recommendations].sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0];
  const risk = snapshot?.risk;
  const marketData = snapshot?.marketData;
  const targetLineEn = largestDelta
    ? `The largest allocation change is ${largestDelta.symbol}: ${largestDelta.deltaPct > 0 ? "+" : ""}${largestDelta.deltaPct} percentage points.`
    : "No material allocation drift is currently available.";
  const targetLineRu = largestDelta
    ? `Максимальное изменение веса: ${largestDelta.symbol}: ${largestDelta.deltaPct > 0 ? "+" : ""}${largestDelta.deltaPct} п.п.`
    : "Существенного отклонения по весам сейчас нет.";

  if (language === "ru") {
    return [
      `Статус провайдера: ${reason}`,
      "",
      "Summary: Локальный аналитический модуль оценил текущий портфель, live-цены, риск-метрики и результат QAOA.",
      `Key Risks: Текущий risk score ${risk?.currentRiskScore ?? "n/a"}/100, оптимизированный score ${risk?.optimizedRiskScore ?? "n/a"}/100. Статус market-data: ${marketData?.status ?? "unknown"}.`,
      `Actionable Insights: ${targetLineRu} Вывод модели является аналитическим и требует проверки перед исполнением.`
    ].join("\n");
  }

  return [
    `Provider status: ${reason}`,
    "",
    "Summary: The local analytical engine evaluated the current portfolio snapshot, live market prices, risk metrics, and QAOA output.",
    `Key Risks: Current risk score is ${risk?.currentRiskScore ?? "n/a"}/100 and optimized score is ${risk?.optimizedRiskScore ?? "n/a"}/100. Market data status is ${marketData?.status ?? "unknown"}.`,
    `Actionable Insights: ${targetLineEn} The model output is informational and should be reviewed before execution.`
  ].join("\n");
};

const buildReadableLocalAdvisorResponse = (question, snapshot, reason = "Groq provider is unavailable.", language = "en") => {
  const recommendations = snapshot?.recommendations ?? [];
  const largestDelta = [...recommendations].sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0];
  const risk = snapshot?.risk;
  const marketData = snapshot?.marketData;
  const targetLineEn = largestDelta
    ? `The largest allocation change is ${largestDelta.symbol}: ${largestDelta.deltaPct > 0 ? "+" : ""}${largestDelta.deltaPct} percentage points.`
    : "No material allocation drift is currently available.";
  const targetLineRu = largestDelta
    ? `Самое большое изменение веса: ${largestDelta.symbol}: ${largestDelta.deltaPct > 0 ? "+" : ""}${largestDelta.deltaPct} п.п.`
    : "Существенного отклонения по весам сейчас нет.";

  if (language === "ru") {
    return [
      `Provider status: ${reason}`,
      "",
      "Summary: Локальный аналитический модуль оценил портфель, живые цены, риск-метрики и последний QAOA-результат.",
      `Key Risks: Текущий risk score ${risk?.currentRiskScore ?? "n/a"}/100, оптимизированный score ${risk?.optimizedRiskScore ?? "n/a"}/100. Статус market-data: ${marketData?.status ?? "unknown"}.`,
      `Actionable Insights: ${targetLineRu} Вывод модели является аналитическим и требует проверки перед исполнением.`
    ].join("\n");
  }

  return [
    `Provider status: ${reason}`,
    "",
    "Summary: The local analytical engine evaluated the current portfolio snapshot, live market prices, risk metrics, and QAOA output.",
    `Key Risks: Current risk score is ${risk?.currentRiskScore ?? "n/a"}/100 and optimized score is ${risk?.optimizedRiskScore ?? "n/a"}/100. Market data status is ${marketData?.status ?? "unknown"}.`,
    `Actionable Insights: ${targetLineEn} The model output is informational and should be reviewed before execution.`
  ].join("\n");
};

const buildGroqMessages = (question, snapshot, language = "en") => [
  {
    role: "system",
    content:
      `You are Quantum Wealth Advisor, a professional crypto portfolio risk manager. Do not provide direct financial advice. Use wording such as 'The mathematical model shows...' and 'The model proposes...'. Answer strictly in three sections: Summary, Key Risks, Actionable Insights. Use the provided live market data, portfolio weights, risk metrics, recommendations, and local QAOA result. Answer language: ${language === "ru" ? "Russian" : "English"}.`
  },
  {
    role: "user",
    content: JSON.stringify(
      {
        question,
        portfolio: snapshot?.assets,
        marketData: snapshot?.marketData,
        risk: snapshot?.risk,
        recommendations: snapshot?.recommendations,
        quantumTask: snapshot?.quantumTask
      },
      null,
      2
    )
  }
];

const askGroq = async (question, snapshot, language = "en") => {
  if (!groqKey) {
    return {
      source: "local-fallback",
      providerStatus: "missing_key",
      text:
        buildReadableLocalAdvisorResponse(question, snapshot, "Groq API key is not configured.", language)
    };
  }

  try {
    const data = await fetchJson(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: buildGroqMessages(question, snapshot, language),
          temperature: 0.2,
          max_tokens: 900
        })
      }
    );
    const text = data.choices?.[0]?.message?.content;

    return {
      source: "groq",
      providerStatus: "ok",
      model: groqModel,
      text: text || "Summary: Groq returned an empty response. Key Risks: no model output was available. Actionable Insights: retry the query."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Groq request failed.";
    const isQuotaError = message.includes("429");

    return {
      source: "local-fallback",
      providerStatus: isQuotaError ? "quota_exceeded" : "provider_error",
      error: message,
      text: buildReadableLocalAdvisorResponse(question, snapshot, isQuotaError ? "Groq quota exceeded for the configured API key." : message, language)
    };
  }
};

const routeRequest = async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  let cachedSession;
  const getRequestSession = async () => {
    if (cachedSession === undefined) {
      cachedSession = await authService.getSession(request);
    }

    return cachedSession;
  };

  if (request.method === "OPTIONS") {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "guardian-local-api" });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/me") {
    const session = await getRequestSession();
    sendJson(response, 200, { user: session?.user ?? null });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/config") {
    sendJson(response, 200, {
      googleEnabled: authService.isGoogleConfigured(),
      stripeBillingEnabled: stripeBillingService.isConfigured()
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/stripe/webhook") {
    const signature = request.headers["stripe-signature"];
    const result = await stripeBillingService.handleWebhook(await readRawBody(request), Array.isArray(signature) ? signature[0] : signature);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/register") {
    const body = await readJsonBody(request);
    const result = await authService.register(request, body);
    sendJson(response, 201, { user: result.user }, { "Set-Cookie": result.sessionCookie });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const result = await authService.login(request, body);
    sendJson(response, 200, { user: result.user }, { "Set-Cookie": result.sessionCookie });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
    const result = await authService.logout(request);
    sendJson(response, 200, { ok: true }, { "Set-Cookie": result.sessionCookie });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/google") {
    sendRedirect(response, await authService.beginGoogleOAuth(request));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/google/callback") {
    const result = await authService.completeGoogleOAuth(request, requestUrl.searchParams);
    sendRedirect(response, result.redirectTo, { "Set-Cookie": result.sessionCookie });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    const session = await getRequestSession();

    if (!session) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/") && !session.user.isAdmin) {
      sendJson(response, 403, { error: "Administrator access is required." });
      return;
    }

    if (session.user.isBlocked && !requestUrl.pathname.startsWith("/api/admin/") && !isBlockedAccountAllowedPath(requestUrl.pathname)) {
      sendJson(response, 423, {
        error: "Account is blocked.",
        account: {
          balanceUsd: session.user.balanceUsd,
          isBlocked: session.user.isBlocked,
          blockedReason: session.user.blockedReason,
          blockedAt: session.user.blockedAt
        }
      });
      return;
    }
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/account/status") {
    const session = await getRequestSession();
    sendJson(response, 200, {
      account: {
        user: session.user,
        balanceUsd: session.user.balanceUsd,
        isBlocked: session.user.isBlocked,
        blockedReason: session.user.blockedReason,
        blockedAt: session.user.blockedAt
      }
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/billing/checkout") {
    const session = await getRequestSession();
    const result = await stripeBillingService.createCheckoutSession(session.user.id);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/billing/portal") {
    const session = await getRequestSession();
    const result = await stripeBillingService.createPortalSession(session.user.id);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/admin/accounts") {
    sendJson(response, 200, await adminStore.listAccounts());
    return;
  }

  const adminAccountMatch = requestUrl.pathname.match(/^\/api\/admin\/accounts\/([^/]+)$/);

  if (request.method === "PATCH" && adminAccountMatch) {
    const session = await getRequestSession();
    const accountId = decodeURIComponent(adminAccountMatch[1]);
    const body = await readJsonBody(request);

    if (session.user.id === accountId && body.isBlocked === true) {
      sendJson(response, 400, { error: "You cannot block your own administrator account." });
      return;
    }

    const account = await adminStore.updateAccount(accountId, body);
    sendJson(response, 200, { account });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/market/prices") {
    const ids = (requestUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const prices = await getCoinPrices(ids, requestUrl.searchParams.get("vs") ?? "usd");
    sendJson(response, 200, { prices });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/market/search") {
    const query = requestUrl.searchParams.get("query")?.trim() ?? "";
    const coins = await searchCoins(query);
    sendJson(response, 200, { coins });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/portfolio/positions") {
    const session = await getRequestSession();
    const positions = await portfolioStore.listPositions(session.user.id);
    sendJson(response, 200, { positions });
    return;
  }

  if (
    (request.method === "PUT" || request.method === "POST") &&
    requestUrl.pathname === "/api/portfolio/positions"
  ) {
    const session = await getRequestSession();
    const body = await readJsonBody(request);
    const positions = await portfolioStore.replacePositions(session.user.id, body.positions ?? []);
    sendJson(response, 200, { positions });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/portfolio/snapshot") {
    const session = await getRequestSession();
    const positions = await portfolioStore.listPositions(session.user.id);
    const result = await buildPortfolioSnapshot({ getCoinPrices, positions });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/portfolio/snapshot") {
    const session = await getRequestSession();
    const body = await readJsonBody(request);
    const positions = Array.isArray(body.positions)
      ? await portfolioStore.replacePositions(session.user.id, body.positions)
      : await portfolioStore.listPositions(session.user.id);
    const result = await buildPortfolioSnapshot({ getCoinPrices, positions });
    sendJson(response, 200, result);
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/analytics/chat"
  ) {
    const body = await readJsonBody(request);
    const result = await askGroq(String(body.question ?? ""), body.snapshot, body.language === "ru" ? "ru" : "en");
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/quantum/latest") {
    const session = await getRequestSession();
    const body = await readJsonBody(request);
    const result = await quantumRunStore.getLatestRun(session.user.id, body.assets ?? []);
    sendJson(response, 200, { task: result });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/quantum/optimize") {
    const session = await getRequestSession();
    const body = await readJsonBody(request);
    const result = simulateLocalQaoa(body.assets ?? []);
    await quantumRunStore.saveRun(session.user.id, body.assets ?? [], result);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "GET") {
    const adminRequest = isAdminHost(requestUrl);
    const shellFileName = adminRequest ? "admin.html" : "index.html";
    const requestedPath = requestUrl.pathname === "/" || requestUrl.pathname === "/admin" || requestUrl.pathname === "/admin/"
      ? `/${shellFileName}`
      : requestUrl.pathname;
    const normalizedPath = requestedPath.replace(/^\/+/, "");
    const staticPath = resolve(staticRoot, normalizedPath);
    const indexPath = join(staticRoot, shellFileName);
    const staticRelativePath = relative(staticRoot, staticPath);
    const isInsideStaticRoot = staticRelativePath === "" || (!staticRelativePath.startsWith("..") && !isAbsolute(staticRelativePath));

    if (isInsideStaticRoot && existsSync(staticPath) && statSync(staticPath).isFile()) {
      sendStaticFile(response, staticPath);
      return;
    }

    if (existsSync(indexPath)) {
      sendStaticFile(response, indexPath);
      return;
    }
  }

  sendJson(response, 404, { error: "Route not found" });
};

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    sendJson(response, statusCode, { error: error.message });
  });
});

server.listen(port, host, () => {
  console.log(`guardian-api ready on http://${host}:${port}`);
});

const shutdown = (signal) => {
  console.log(`guardian-api received ${signal}, shutting down`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  server.close(() => {
    Promise.resolve(db.close())
      .catch((error) => {
        console.error("failed to close database pool", error);
      })
      .finally(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
