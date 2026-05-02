import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-02-25.clover";

class BillingError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const nowIso = () => new Date().toISOString();

const isUnsetConfigValue = (value) => {
  const text = String(value ?? "").trim();

  return !text || text.startsWith("replace-with-") || text.startsWith("your-");
};

const toIsoFromUnix = (seconds) => {
  const value = Number(seconds ?? 0);

  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
};

const cleanUrl = (value, fallback) => {
  const text = String(value ?? "").trim();

  return text || fallback;
};

export const createStripeBillingService = ({ db, port }) => {
  if (!db) {
    throw new Error("Stripe billing service requires a PostgreSQL database instance.");
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const stripePriceId = process.env.STRIPE_PRICE_ID ?? "";
  const appOrigin = cleanUrl(process.env.APP_ORIGIN, `http://127.0.0.1:${port ?? 8787}`);
  const stripe = isUnsetConfigValue(stripeSecretKey)
    ? null
    : new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });

  const assertConfigured = () => {
    if (!stripe) {
      throw new BillingError(503, "Stripe is not configured. Set STRIPE_SECRET_KEY.");
    }

    if (isUnsetConfigValue(stripePriceId)) {
      throw new BillingError(503, "Stripe price is not configured. Set STRIPE_PRICE_ID.");
    }
  };

  const getUserById = async (userId) => {
    const result = await db.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    const user = result.rows[0];

    if (!user) {
      throw new BillingError(404, "User was not found.");
    }

    return user;
  };

  const getOrCreateCustomerId = async (user) => {
    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id
      }
    });

    await db.query(
      "UPDATE users SET stripe_customer_id = $1, updated_at = $2 WHERE id = $3",
      [customer.id, nowIso(), user.id]
    );

    return customer.id;
  };

  const updateUserSubscription = async ({ customerId, subscription }) => {
    if (!customerId || !subscription?.id) {
      return;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

    await db.query(
      `UPDATE users
       SET stripe_subscription_id = $1,
           stripe_subscription_status = $2,
           stripe_price_id = $3,
           stripe_current_period_end = $4,
           updated_at = $5
       WHERE stripe_customer_id = $6`,
      [
        subscription.id,
        subscription.status ?? null,
        priceId,
        toIsoFromUnix(subscription.current_period_end),
        nowIso(),
        customerId
      ]
    );
  };

  return {
    isConfigured() {
      return Boolean(stripe) && !isUnsetConfigValue(stripePriceId);
    },

    async createCheckoutSession(userId) {
      assertConfigured();

      const user = await getUserById(userId);
      const customerId = await getOrCreateCustomerId(user);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: stripePriceId,
            quantity: 1
          }
        ],
        success_url: `${appOrigin}/?billing=success`,
        cancel_url: `${appOrigin}/?billing=cancelled`,
        client_reference_id: user.id,
        subscription_data: {
          metadata: {
            userId: user.id
          }
        }
      });

      return { url: session.url };
    },

    async createPortalSession(userId) {
      if (!stripe) {
        throw new BillingError(503, "Stripe is not configured. Set STRIPE_SECRET_KEY.");
      }

      const user = await getUserById(userId);
      const customerId = await getOrCreateCustomerId(user);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: appOrigin
      });

      return { url: session.url };
    },

    async handleWebhook(rawBody, signature) {
      if (!stripe) {
        throw new BillingError(503, "Stripe is not configured. Set STRIPE_SECRET_KEY.");
      }

      if (isUnsetConfigValue(stripeWebhookSecret)) {
        throw new BillingError(503, "Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.");
      }

      let event;

      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
      } catch (error) {
        throw new BillingError(400, error instanceof Error ? error.message : "Invalid Stripe webhook signature.");
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription), {
            expand: ["items.data.price"]
          });
          await updateUserSubscription({
            customerId: String(session.customer),
            subscription
          });
        }
      }

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const subscription = event.data.object;
        await updateUserSubscription({
          customerId: String(subscription.customer ?? ""),
          subscription
        });
      }

      return { received: true, type: event.type };
    }
  };
};
