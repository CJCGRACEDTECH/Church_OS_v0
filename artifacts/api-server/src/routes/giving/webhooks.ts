import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, donationsTable, givingIntentsTable, recurringDonationsTable, usersTable } from "@workspace/db";
import { validStripeSignature } from "../../lib/payments/providers/stripe";
import { validSquareSignature } from "../../lib/payments/providers/square";
import { validPaypalWebhook } from "../../lib/payments/providers/paypal";
import { setIntentStatus, setIntentStatusByProviderRef } from "../../lib/payments/intent";
import { positiveIntegerOrNull } from "./shared";

const router: IRouter = Router();

router.post("/giving/stripe/webhook", async (req, res): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "Stripe webhook secret is not configured." });
      return;
    }
    // Development only: allow unsigned test webhooks when secret is absent
  } else {
    const signature = req.headers["stripe-signature"];
    if (!validStripeSignature(rawBody, signature, webhookSecret)) {
      res.status(400).json({ error: "Invalid Stripe signature." });
      return;
    }
  }

  const event = JSON.parse(rawBody.toString()) as { type?: string; data?: { object?: Record<string, unknown> } };
  await syncStripeEvent(event.type ?? "", event.data?.object ?? {});
  res.json({ received: true });
});

async function syncStripeEvent(type: string, object: Record<string, unknown>) {
  if (type === "checkout.session.completed") {
    const sessionId = String(object.id ?? "");
    const paymentIntent = object.payment_intent ? String(object.payment_intent) : null;
    const customer = object.customer ? String(object.customer) : null;
    const subscription = object.subscription ? String(object.subscription) : null;
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, string> : {};
    const serviceSessionId = positiveIntegerOrNull(metadata.service_session_id);
    await db.update(donationsTable).set({
      paymentStatus: "succeeded",
      stripePaymentIntentId: paymentIntent,
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription,
      providerTransactionId: paymentIntent,
      providerCustomerId: customer,
      rawProviderPayload: object,
      ...(serviceSessionId ? { serviceSessionId } : {}),
    }).where(eq(donationsTable.stripeCheckoutSessionId, sessionId));

    const intentId = positiveIntegerOrNull(metadata.giving_intent_id);
    if (intentId) {
      await setIntentStatus(intentId, "completed");
    } else if (sessionId) {
      await setIntentStatusByProviderRef(sessionId, "completed");
    }

    if (subscription && metadata.member_id) {
      await db.update(recurringDonationsTable).set({
        stripeSubscriptionId: subscription,
        stripeCustomerId: customer,
        status: "active",
      }).where(and(eq(recurringDonationsTable.memberId, Number(metadata.member_id)), eq(recurringDonationsTable.status, "incomplete")));
    }
  }
  if (type === "checkout.session.expired") {
    const sessionId = String(object.id ?? "");
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, string> : {};
    if (sessionId) {
      await db.update(donationsTable).set({ paymentStatus: "failed", rawProviderPayload: object })
        .where(and(eq(donationsTable.stripeCheckoutSessionId, sessionId), eq(donationsTable.paymentStatus, "pending")));
      const intentId = positiveIntegerOrNull(metadata.giving_intent_id);
      if (intentId) {
        await setIntentStatus(intentId, "expired");
      } else {
        await setIntentStatusByProviderRef(sessionId, "expired");
      }
    }
  }
  if (type === "invoice.payment_succeeded" || type === "invoice.paid") {
    await recordSubscriptionInvoice(object);
  }
  if (type === "invoice.payment_failed") {
    const subscriptionId = invoiceSubscriptionId(object);
    if (subscriptionId) {
      await db.update(recurringDonationsTable).set({ status: "past_due" })
        .where(eq(recurringDonationsTable.stripeSubscriptionId, subscriptionId));
    }
  }
  if (type === "payment_intent.payment_failed") {
    await db.update(donationsTable).set({ paymentStatus: "failed", rawProviderPayload: object }).where(eq(donationsTable.stripePaymentIntentId, String(object.id ?? "")));
  }
  if (type === "charge.refunded") {
    await db.update(donationsTable).set({ paymentStatus: "refunded", rawProviderPayload: object }).where(eq(donationsTable.stripePaymentIntentId, String(object.payment_intent ?? "")));
  }
  if (type === "charge.dispute.created") {
    await db.update(donationsTable).set({ paymentStatus: "disputed", rawProviderPayload: object }).where(eq(donationsTable.stripePaymentIntentId, String(object.payment_intent ?? "")));
  }
  if (type === "customer.subscription.deleted") {
    await db.update(recurringDonationsTable).set({
      status: "cancelled",
      cancelledAt: new Date(),
    }).where(eq(recurringDonationsTable.stripeSubscriptionId, String(object.id ?? "")));
  }
}

function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  if (invoice.subscription) return String(invoice.subscription);
  const parent = invoice.parent as Record<string, unknown> | undefined;
  const subDetails = parent?.subscription_details as Record<string, unknown> | undefined;
  return subDetails?.subscription ? String(subDetails.subscription) : null;
}

async function recordSubscriptionInvoice(invoice: Record<string, unknown>) {
  const invoiceId = String(invoice.id ?? "");
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!invoiceId || !subscriptionId) return;

  const [recurring] = await db.select().from(recurringDonationsTable)
    .where(eq(recurringDonationsTable.stripeSubscriptionId, subscriptionId));
  if (!recurring) return;

  // The first invoice of a subscription is already covered by the
  // checkout-session donation created at signup; don't double-record it.
  const isFirstInvoice = invoice.billing_reason === "subscription_create";
  if (!isFirstInvoice) {
    const donor = await memberContact(recurring.memberId);
    const amountCents = typeof invoice.amount_paid === "number" ? invoice.amount_paid : recurring.amountCents;
    const paidAtSeconds = typeof invoice.status_transitions === "object" && invoice.status_transitions
      ? (invoice.status_transitions as Record<string, unknown>).paid_at
      : null;
    const donationDate = typeof paidAtSeconds === "number" ? new Date(paidAtSeconds * 1000) : new Date();
    await db.insert(donationsTable).values({
      churchId: recurring.churchId,
      memberId: recurring.memberId,
      donorName: donor?.name ?? null,
      donorEmail: donor?.email ?? null,
      amountCents,
      donationDate,
      donationType: "recurring",
      givingCategory: recurring.givingCategory,
      campaignId: recurring.campaignId,
      paymentMethod: "stripe",
      providerTransactionId: invoiceId,
      providerCustomerId: invoice.customer ? String(invoice.customer) : recurring.stripeCustomerId,
      providerReceiptUrl: invoice.hosted_invoice_url ? String(invoice.hosted_invoice_url) : null,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: invoice.customer ? String(invoice.customer) : recurring.stripeCustomerId,
      stripeReceiptUrl: invoice.hosted_invoice_url ? String(invoice.hosted_invoice_url) : null,
      rawProviderPayload: invoice,
      paymentStatus: "succeeded",
      taxDeductible: true,
    }).onConflictDoNothing();
  }

  const nextPaymentSeconds = invoice.period_end;
  await db.update(recurringDonationsTable).set({
    status: "active",
    ...(typeof nextPaymentSeconds === "number" ? { nextPaymentDate: new Date(nextPaymentSeconds * 1000) } : {}),
  }).where(eq(recurringDonationsTable.id, recurring.id));
}

async function memberContact(memberId: number | null) {
  if (!memberId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, memberId));
  return user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null;
}

router.post("/giving/square/webhook", async (req, res): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!signatureKey) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "Square webhook signature key is not configured." });
      return;
    }
    // Development only: allow unsigned test webhooks when key is absent
  } else {
    const notificationUrl = `${process.env.API_PUBLIC_URL ?? ""}/api/giving/square/webhook`;
    const signature = req.headers["x-square-hmacsha256-signature"];
    if (!validSquareSignature(rawBody, signature, signatureKey, notificationUrl)) {
      res.status(400).json({ error: "Invalid Square signature." });
      return;
    }
  }

  const event = JSON.parse(rawBody.toString()) as { type?: string; data?: { object?: Record<string, unknown> } };
  await syncSquareEvent(event.type ?? "", event.data?.object ?? {});
  res.json({ received: true });
});

async function syncSquareEvent(type: string, object: Record<string, unknown>) {
  if (type === "payment.updated" || type === "payment.created") {
    const payment = (object.payment ?? object) as Record<string, unknown>;
    const status = String(payment.status ?? "");
    const orderId = payment.order_id ? String(payment.order_id) : null;
    const paymentId = payment.id ? String(payment.id) : null;
    if (!orderId || !paymentId || status !== "COMPLETED") return;

    const [intent] = await db.select().from(givingIntentsTable).where(eq(givingIntentsTable.providerRef, orderId));
    if (!intent) return;

    const amountMoney = payment.amount_money as Record<string, unknown> | undefined;
    const amountCents = typeof amountMoney?.amount === "number" ? amountMoney.amount : intent.amountCents;
    const donor = await memberContact(intent.memberId);
    await db.insert(donationsTable).values({
      churchId: intent.churchId,
      memberId: intent.memberId,
      donorName: donor?.name ?? intent.donorName,
      donorEmail: donor?.email ?? intent.donorEmail,
      amountCents,
      donationDate: new Date(),
      donationType: "one_time",
      givingCategory: intent.givingCategory,
      campaignId: intent.campaignId,
      serviceSessionId: intent.serviceSessionId,
      givingIntentId: intent.id,
      paymentMethod: "square",
      providerTransactionId: paymentId,
      providerReceiptUrl: payment.receipt_url ? String(payment.receipt_url) : null,
      rawProviderPayload: payment,
      paymentStatus: "succeeded",
      taxDeductible: true,
    }).onConflictDoNothing();
    await setIntentStatus(intent.id, "completed");
  }
  if (type === "refund.updated") {
    const refund = (object.refund ?? object) as Record<string, unknown>;
    if (String(refund.status ?? "") !== "COMPLETED") return;
    const paymentId = refund.payment_id ? String(refund.payment_id) : null;
    if (!paymentId) return;
    await db.update(donationsTable).set({ paymentStatus: "refunded", rawProviderPayload: refund })
      .where(and(eq(donationsTable.paymentMethod, "square"), eq(donationsTable.providerTransactionId, paymentId)));
  }
}

router.post("/giving/paypal/webhook", async (req, res): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "PayPal webhook ID is not configured." });
      return;
    }
    // Development only: allow unsigned test webhooks when webhook ID is absent
  } else {
    const verified = await validPaypalWebhook(rawBody, req.headers as Record<string, string | string[] | undefined>);
    if (!verified) {
      res.status(400).json({ error: "Invalid PayPal webhook signature." });
      return;
    }
  }

  const event = JSON.parse(rawBody.toString()) as { event_type?: string; resource?: Record<string, unknown> };
  await syncPaypalEvent(event.event_type ?? "", event.resource ?? {});
  res.json({ received: true });
});

async function syncPaypalEvent(type: string, resource: Record<string, unknown>) {
  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const captureId = resource.id ? String(resource.id) : null;
    const supplementary = resource.supplementary_data as Record<string, unknown> | undefined;
    const relatedIds = supplementary?.related_ids as Record<string, unknown> | undefined;
    const orderId = relatedIds?.order_id ? String(relatedIds.order_id) : null;
    if (!captureId || !orderId) return;

    const [donation] = await db.select().from(donationsTable).where(eq(donationsTable.providerTransactionId, orderId));
    if (!donation) return;

    await db.update(donationsTable).set({
      paymentStatus: "succeeded",
      providerTransactionId: captureId,
      rawProviderPayload: resource,
    }).where(eq(donationsTable.id, donation.id));

    if (donation.givingIntentId) {
      await setIntentStatus(donation.givingIntentId, "completed");
    } else {
      await setIntentStatusByProviderRef(orderId, "completed");
    }
  }
  if (type === "PAYMENT.CAPTURE.DENIED") {
    const supplementary = resource.supplementary_data as Record<string, unknown> | undefined;
    const relatedIds = supplementary?.related_ids as Record<string, unknown> | undefined;
    const orderId = relatedIds?.order_id ? String(relatedIds.order_id) : null;
    if (!orderId) return;
    await db.update(donationsTable).set({ paymentStatus: "failed", rawProviderPayload: resource })
      .where(eq(donationsTable.providerTransactionId, orderId));
    await setIntentStatusByProviderRef(orderId, "failed");
  }
  if (type === "PAYMENT.CAPTURE.REFUNDED") {
    const captureId = resource.id ? String(resource.id) : null;
    const links = resource.links as { rel?: string; href?: string }[] | undefined;
    const upLink = links?.find((link) => link.rel === "up")?.href ?? "";
    const originalCaptureId = upLink.split("/captures/")[1]?.split("?")[0] ?? captureId;
    if (!originalCaptureId) return;
    await db.update(donationsTable).set({ paymentStatus: "refunded", rawProviderPayload: resource })
      .where(eq(donationsTable.providerTransactionId, originalCaptureId));
  }
  if (type === "CUSTOMER.DISPUTE.CREATED") {
    const disputedTransactions = resource.disputed_transactions as { seller_transaction_id?: string }[] | undefined;
    const transactionId = disputedTransactions?.[0]?.seller_transaction_id;
    if (!transactionId) return;
    await db.update(donationsTable).set({ paymentStatus: "disputed", rawProviderPayload: resource })
      .where(eq(donationsTable.providerTransactionId, transactionId));
  }
}

export default router;
