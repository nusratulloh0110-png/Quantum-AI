# Quantum-AI Wealth Guardian

Working local product for crypto portfolio risk analysis and manual QUBO/QAOA optimization.

## What Works

- Real user portfolio input: symbol, CoinGecko ID, name, and amount.
- CoinGecko live pricing and asset search through the local API.
- Manual quantum run: the Quantum tab stays quiet until the user presses **Run calculation**.
- Local statevector QAOA engine returns qubits, shots, best bitstring, energy, beta/gamma, state probabilities, asset-level target weights, and deltas.
- AI analytics panel answers only after the user asks a question and renders responses as structured sections.
- Execution tab shows a read-only rebalance plan until exchange keys are connected.

## Run Locally

```bash
npm install
docker compose up -d postgres
npm run check
npm run dev
```

Local URLs:

- App: `http://127.0.0.1:8787/`
- Health: `http://127.0.0.1:8787/health`
- API: `http://127.0.0.1:8787/api/*`

Useful commands:

```bash
npm run typecheck       # TypeScript only
npm run test            # Vitest suite
npm run build           # Production frontend build
npm run check           # Tests + production build
npm run health          # Check http://127.0.0.1:8787/health
```

## Environment

Use `.env.local` for real local keys. Values without `VITE_` stay on the local server and are not bundled into the browser.

Required live configuration:

```bash
COINGECKO_DEMO_API_KEY=your-coingecko-demo-api-key
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=postgresql://guardian:guardian@127.0.0.1:5432/guardian
```

Authentication is local-first:

- Email/password users are stored in PostgreSQL with salted PBKDF2 password hashes.
- Sessions are stored server-side and sent to the browser as HTTP-only cookies.
- Login, logout, registration, and Google sign-in attempts are written to `auth_logs`.
- Portfolio assets are stored in `portfolio_positions` with a `user_id`, so every account has its own asset list.

For Google sign-in, create OAuth Web credentials in Google Cloud Console and set:

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/auth/google/callback
APP_ORIGIN=http://127.0.0.1:8787
```

Add the same redirect URI in Google Cloud Console. If you run the Vite client separately on `http://127.0.0.1:5173/`, set `APP_ORIGIN=http://127.0.0.1:5173`.

Stripe billing uses hosted Checkout for subscription signup and Stripe Customer Portal for self-service billing:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

Create a recurring Price in Stripe and use its `price_...` ID. For local webhook testing, run Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:8787/api/stripe/webhook
```

Then copy the emitted `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. For production, point Stripe webhooks to:

```text
https://domen.domen/api/stripe/webhook
```

Subscribe these webhook events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

## Product Flow

1. Open **Assets** and enter real holdings.
2. Save the portfolio to refresh live prices and current weights.
3. Open **Quantum Run** and press **Run calculation**.
4. Review the QUBO/QAOA explanation, best bitstring, state probabilities, target weights, and asset deltas.
5. Ask AI analytics for a written risk explanation if needed.

## Notes

This build runs a local statevector QAOA engine. Remote quantum hardware execution requires provider credentials and a backend adapter such as AWS Braket or IBM Quantum.

## Production Deploy

The app is prepared for one backend serving two domains:

- User app: `https://domen.domen`
- Admin panel: `https://admin.domen.domen`

The Node server serves `admin.html` automatically when the request host starts with `admin.`. API routes stay under `/api/*`.

1. Copy the production template and fill real values:

```bash
cp .env.production.example .env.production
```

Set at minimum:

```bash
APP_ORIGIN=https://domen.domen
ADMIN_ORIGIN=https://admin.domen.domen
ADMIN_EMAILS=owner@domen.domen
POSTGRES_PASSWORD=strong-password
COINGECKO_DEMO_API_KEY=real-key
GROQ_API_KEY=real-key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

2. Validate the app and Docker Compose configuration:

```bash
npm ci
npm run deploy:check
```

3. Build and start on the server:

```bash
npm run deploy:up
```

4. Check health and logs:

```bash
npm run health
npm run deploy:logs
```

5. Install the Nginx config from `deploy/nginx.conf`, replace `domen.domen` with the real domains, then issue TLS certificates and reload Nginx.

6. Register or sign in with an email listed in `ADMIN_EMAILS`. That account will have admin access even if the database `is_admin` flag is still false.

Docker image details:

- Runtime base: `node:20-alpine`.
- Exposed port: `8787` by default.
- Health endpoint: `/health`.
- Container start command: `node server/local-api.mjs`.
- Required database variable: `DATABASE_URL`.
- `requirements.txt` is intentionally empty because the production app has no Python runtime dependencies.

Node-only deploy without Docker is also possible:

```bash
npm ci
npm run build
NODE_ENV=production HOST=0.0.0.0 LOCAL_API_PORT=8787 npm start
```

## Admin Panel

Admin routes:

- `GET /api/admin/accounts` lists all accounts, balances, blocking state, sessions, and portfolio position count.
- `PATCH /api/admin/accounts/:id` updates `balanceUsd`, `isBlocked`, `blockedReason`, and `adminNote`.

Blocked users keep seeing their account status and assigned balance on their account screen. Portfolio, market, analytics, and quantum APIs return `423 Account is blocked` for blocked users.
