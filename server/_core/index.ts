import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { clerkMiddleware } from "@clerk/express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleTelegramWebhook, handleApprovalToken } from "../webhooks";
import { startPollingJob } from "../reviewPipeline";
import { cleanExpiredTokens } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Stripe webhook MUST receive raw body — register BEFORE express.json()
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe] Test event detected");
        return res.json({ verified: true });
      }
      const { getDb } = await import("../db");
      const { clients, users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();

      // ── Hosted checkout flow (legacy) ──────────────────────────────────────
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const planId = session.metadata?.plan_id ?? "entry";
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
        if (userId && db) {
          await db.update(clients).set({ subscriptionStatus: "active" }).where(eq(clients.userId, userId));
          console.log(`[Stripe] checkout.session.completed: user ${userId} → ${planId}`);
        }
      }

      // ── Stripe Elements / SetupIntent flow ─────────────────────────────────
      // Fires when a SetupIntent (from our onboarding trial flow) succeeds
      if (event.type === "setup_intent.succeeded") {
        const setupIntent = event.data.object as import("stripe").Stripe.SetupIntent;
        const customerId = typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
        const subscriptionId = setupIntent.metadata?.subscription_id;
        const planId = setupIntent.metadata?.plan_id ?? "entry";
        console.log(`[Stripe] setup_intent.succeeded: customer=${customerId} sub=${subscriptionId} plan=${planId}`);

        if (customerId && db) {
          // Attach payment method to subscription as default
          if (subscriptionId && setupIntent.payment_method) {
            try {
              const pmId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method.id;
              await stripe.subscriptions.update(subscriptionId, {
                default_payment_method: pmId,
              });
              console.log(`[Stripe] Attached PM ${pmId} to subscription ${subscriptionId}`);
            } catch (e) {
              console.error("[Stripe] Failed to attach PM to subscription:", e);
            }
          }

          // Find user by Stripe customer email
          const customer = await stripe.customers.retrieve(customerId) as import("stripe").Stripe.Customer;
          const email = customer.email;
          if (email) {
            const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
            const user = userRows[0];
            if (user) {
              // Update or create client record
              const clientRows = await db.select().from(clients).where(eq(clients.userId, user.id)).limit(1);
              if (clientRows[0]) {
                await db.update(clients).set({ subscriptionStatus: "trial" }).where(eq(clients.userId, user.id));
                console.log(`[Stripe] setup_intent: Updated client for user ${user.id} to trial`);
              } else {
                await db.insert(clients).values({
                  userId: user.id,
                  businessName: user.name ?? email,
                  contactEmail: email,
                  subscriptionStatus: "trial",
                });
                console.log(`[Stripe] setup_intent: Created client record for user ${user.id}`);
              }
            } else {
              console.log(`[Stripe] setup_intent: No user found for email ${email} — will activate on first sign-in`);
            }
          }
        }
      }

      // ── Subscription created/updated (covers both flows) ───────────────────
      if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object as import("stripe").Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const stripeStatus = subscription.status; // trialing, active, canceled, past_due, etc.
        const planId = subscription.metadata?.plan_id ?? "entry";

        // Map Stripe status → our DB status
        const dbStatus: "trial" | "active" | "paused" | "cancelled" =
          stripeStatus === "trialing" ? "trial" :
          stripeStatus === "active" ? "active" :
          stripeStatus === "canceled" ? "cancelled" : "paused";

        console.log(`[Stripe] ${event.type}: customer=${customerId} status=${stripeStatus}→${dbStatus} plan=${planId}`);

        if (db) {
          const customer = await stripe.customers.retrieve(customerId) as import("stripe").Stripe.Customer;
          const email = customer.email;
          if (email) {
            const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
            const user = userRows[0];
            if (user) {
              const clientRows = await db.select().from(clients).where(eq(clients.userId, user.id)).limit(1);
              if (clientRows[0]) {
                await db.update(clients).set({ subscriptionStatus: dbStatus }).where(eq(clients.userId, user.id));
                console.log(`[Stripe] Updated client for user ${user.id} → ${dbStatus}`);
              } else if (dbStatus === "trial" || dbStatus === "active") {
                await db.insert(clients).values({
                  userId: user.id,
                  businessName: user.name ?? email,
                  contactEmail: email,
                  subscriptionStatus: dbStatus,
                });
                console.log(`[Stripe] Created client for user ${user.id} → ${dbStatus}`);
              }
            }
          }
        }
      }

      // ── Subscription deleted ───────────────────────────────────────────────
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as import("stripe").Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        if (db) {
          const customer = await stripe.customers.retrieve(customerId) as import("stripe").Stripe.Customer;
          const email = customer.email;
          if (email) {
            const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
            const user = userRows[0];
            if (user) {
              await db.update(clients).set({ subscriptionStatus: "cancelled" }).where(eq(clients.userId, user.id));
              console.log(`[Stripe] Subscription deleted: user ${user.id} → cancelled`);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[Stripe] Webhook error:", err);
      res.status(400).send("Webhook error");
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  if (ENV.clerkSecretKey && ENV.clerkPublishableKey) {
    app.use(
      clerkMiddleware({
        secretKey: ENV.clerkSecretKey,
        publishableKey: ENV.clerkPublishableKey,
      })
    );
  } else {
    console.warn("[Clerk] CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY missing — API auth disabled");
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Telegram bot webhook (must be before tRPC to avoid conflicts)
  app.post("/api/telegram/webhook", handleTelegramWebhook);

  // Email approval token handler
  app.get("/api/approval/token/:token", handleApprovalToken);

  // Demo onboarding approve/deny endpoints
  app.get("/api/demo/approve", async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).send("Missing token");
    try {
      const { demoApprovals } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).send("DB unavailable");
      const rows = await db.select().from(demoApprovals).where(eq(demoApprovals.token, token)).limit(1);
      const row = rows[0];
      if (!row) return res.status(404).send("Token not found");
      if (row.expiresAt < Date.now()) return res.status(410).send("Token expired");
      await db.update(demoApprovals).set({ decision: "approved", decidedAt: Date.now() }).where(eq(demoApprovals.token, token));
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Response Approved</title></head><body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;max-width:400px;padding:40px"><div style="font-size:64px;margin-bottom:16px">✅</div><h1 style="color:#16a34a;font-size:24px;margin:0 0 8px">Response Approved!</h1><p style="color:#4b5563;margin:0 0 24px">Your approval has been recorded. Go back to WatchReviews to see the simulated result.</p><a href="https://fourthwatchtech.com/free-trial" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Back to WatchReviews</a></div></body></html>`);
    } catch (err) {
      console.error("[Demo] Approve error:", err);
      res.status(500).send("Error processing approval");
    }
  });

  app.get("/api/demo/deny", async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).send("Missing token");
    try {
      const { demoApprovals } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).send("DB unavailable");
      const rows = await db.select().from(demoApprovals).where(eq(demoApprovals.token, token)).limit(1);
      const row = rows[0];
      if (!row) return res.status(404).send("Token not found");
      if (row.expiresAt < Date.now()) return res.status(410).send("Token expired");
      await db.update(demoApprovals).set({ decision: "denied", decidedAt: Date.now() }).where(eq(demoApprovals.token, token));
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Response Denied</title></head><body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#fef2f2;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;max-width:400px;padding:40px"><div style="font-size:64px;margin-bottom:16px">❌</div><h1 style="color:#dc2626;font-size:24px;margin:0 0 8px">Response Denied</h1><p style="color:#4b5563;margin:0 0 24px">No problem — you can always customize the response. Go back to WatchReviews to continue.</p><a href="https://fourthwatchtech.com/free-trial" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Back to WatchReviews</a></div></body></html>`);
    } catch (err) {
      console.error("[Demo] Deny error:", err);
      res.status(500).send("Error processing denial");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the review polling job (every 15 minutes)
    if (process.env.NODE_ENV !== "test") {
      startPollingJob(15 * 60 * 1000);
      // Clean up expired approval tokens every 6 hours
      setInterval(async () => {
        try {
          await cleanExpiredTokens();
          console.log("[Cleanup] Expired approval tokens removed");
        } catch (err) {
          console.error("[Cleanup] Token cleanup failed:", err);
        }
      }, 6 * 60 * 60 * 1000);
    }
  });
}

startServer().catch(console.error);
