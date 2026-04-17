/**
 * Billing routes — Stripe Checkout, Customer Portal, and webhook handler.
 *
 * Routes:
 *   POST /api/billing/checkout       — create a Stripe Checkout session
 *   POST /api/billing/portal         — create a Customer Portal session
 *   GET  /api/billing/status         — current plan & limits for the org
 *   POST /api/billing/webhook        — Stripe webhook receiver (no auth)
 *
 * All routes except /webhook require an authenticated session (requireAuth).
 * The /webhook route uses Stripe's signature verification instead.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import { organizationsTable, stripeEventsTable, auditLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middlewares/errorHandler";
import { requireAuth } from "../middlewares/tenantContext";
import { requireFeature } from "../middlewares/rbac";
import { PLAN_LIMITS, getStripePrices, type PlanTier } from "../lib/plans";
import { logger } from "../lib/logger";
import { apiCache } from "../lib/cache";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Stripe client (lazily initialised — null if not configured)
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  _stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  orgId: string,
  orgName: string
): Promise<string> {
  const [org] = await db
    .select({ stripeCustomerId: organizationsTable.stripeCustomerId })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  if (org?.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: orgName,
    metadata: { orgId },
  });

  await db
    .update(organizationsTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizationsTable.id, orgId));

  return customer.id;
}

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
// ---------------------------------------------------------------------------

const CheckoutBody = z.object({
  plan: z.enum(["pro", "team"]),
});

router.post(
  "/billing/checkout",
  requireAuth,
  requireFeature("BILLING_PORTAL"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }

    const stripe = getStripe();
    const prices = getStripePrices();
    const priceId = parsed.data.plan === "pro" ? prices.pro : prices.team;

    if (!priceId) {
      res.status(503).json({
        error: `Stripe price for ${parsed.data.plan} plan not configured`,
      });
      return;
    }

    const ctx = req.ctx!;
    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, ctx.orgId))
      .limit(1);

    const customerId = await getOrCreateStripeCustomer(
      stripe,
      ctx.orgId,
      org?.name ?? ctx.orgId
    );

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/settings/billing?checkout=success`,
      cancel_url: `${frontendUrl}/settings/billing?checkout=cancelled`,
      metadata: { orgId: ctx.orgId, plan: parsed.data.plan },
      subscription_data: {
        metadata: { orgId: ctx.orgId, plan: parsed.data.plan },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  })
);

// ---------------------------------------------------------------------------
// POST /api/billing/portal
// ---------------------------------------------------------------------------

router.post(
  "/billing/portal",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const stripe = getStripe();
    const ctx = req.ctx!;

    const [org] = await db
      .select({ stripeCustomerId: organizationsTable.stripeCustomerId, name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, ctx.orgId))
      .limit(1);

    if (!org?.stripeCustomerId) {
      res.status(400).json({
        error: "No billing account found. Complete a checkout first.",
      });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${frontendUrl}/settings/billing`,
    });

    res.json({ url: session.url });
  })
);

// ---------------------------------------------------------------------------
// GET /api/billing/status
// ---------------------------------------------------------------------------

router.get(
  "/billing/status",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = req.ctx!;
    const limits = PLAN_LIMITS[ctx.plan];

    res.json({
      plan: ctx.plan,
      limits,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/billing/webhook
// ---------------------------------------------------------------------------

/**
 * Stripe webhook endpoint — no session auth, uses signature verification.
 *
 * Must receive the raw request body (not JSON-parsed) for signature
 * verification. Mounted on app.ts with express.raw() before json().
 */
router.post(
  "/billing/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn("Stripe webhook received but STRIPE_WEBHOOK_SECRET not configured");
      res.status(400).json({ error: "Webhook not configured" });
      return;
    }

    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret
      );
    } catch (err) {
      logger.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    // Idempotency — skip already-processed events
    const [existing] = await db
      .select({ id: stripeEventsTable.id, processedAt: stripeEventsTable.processedAt })
      .from(stripeEventsTable)
      .where(eq(stripeEventsTable.stripeEventId, event.id))
      .limit(1);

    if (existing?.processedAt) {
      logger.debug({ eventId: event.id }, "Stripe event already processed — skipping");
      res.json({ received: true });
      return;
    }

    // Persist the raw event
    const eventRowId = randomUUID();
    await db
      .insert(stripeEventsTable)
      .values({
        stripeEventId: event.id,
        type: event.type,
        data: event as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();

    // Process known event types
    try {
      await handleStripeEvent(event);

      await db
        .update(stripeEventsTable)
        .set({ processedAt: new Date() })
        .where(eq(stripeEventsTable.stripeEventId, event.id));

      logger.info({ eventId: event.id, type: event.type }, "Stripe event processed");
    } catch (err) {
      logger.error({ err, eventId: event.id, type: event.type }, "Stripe event processing failed");
      // Return 200 so Stripe doesn't retry — the event is stored for manual replay
    }

    // Silence TS "eventRowId declared but not used"
    void eventRowId;
    res.json({ received: true });
  })
);

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const plan = session.metadata?.plan as PlanTier | undefined;
      if (orgId && plan) {
        await activateSubscription(orgId, session.customer as string, plan);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      const plan = sub.metadata?.plan as PlanTier | undefined;
      if (orgId) {
        const newPlan: PlanTier = sub.status === "active" ? (plan ?? "free") : "free";
        const [current] = await db
          .select({ plan: organizationsTable.plan })
          .from(organizationsTable)
          .where(eq(organizationsTable.id, orgId))
          .limit(1);
        await activateSubscription(orgId, sub.customer as string, newPlan);
        if (current && current.plan !== newPlan) {
          await db.insert(auditLogTable).values({
            orgId,
            userId: null,
            action: "billing.plan_changed",
            metadata: {
              from: current.plan,
              to: newPlan,
              source: "stripe.subscription.updated",
              subscriptionStatus: sub.status,
              subscriptionId: sub.id,
            },
            createdAt: new Date(),
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        // Per product spec: downgrade to free WITHOUT scheduling org deletion.
        // Account/org closure is a separate user-initiated flow (DELETE /api/account).
        const [current] = await db
          .select({ plan: organizationsTable.plan })
          .from(organizationsTable)
          .where(eq(organizationsTable.id, orgId))
          .limit(1);
        await activateSubscription(orgId, sub.customer as string, "free");
        await db.insert(auditLogTable).values({
          orgId,
          userId: null,
          action: "billing.subscription_cancelled",
          metadata: {
            from: current?.plan ?? "unknown",
            to: "free",
            source: "stripe.subscription.deleted",
            subscriptionId: sub.id,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          },
          createdAt: new Date(),
        });
        logger.info(
          { orgId, subscriptionId: sub.id, previousPlan: current?.plan },
          "Subscription cancelled — org downgraded to free tier (not purged)"
        );
      }
      break;
    }

    default:
      // Ignore other event types
      break;
  }
}

async function activateSubscription(
  orgId: string,
  stripeCustomerId: string,
  plan: PlanTier
): Promise<void> {
  await db
    .update(organizationsTable)
    .set({ plan, stripeCustomerId, updatedAt: new Date() })
    .where(eq(organizationsTable.id, orgId));

  // Clear any plan-related cache entries
  apiCache.invalidate("billing:");
  logger.info({ orgId, plan }, "Organisation plan updated");
}

export default router;
