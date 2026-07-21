import { createHmac, timingSafeEqual } from "node:crypto";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createStripeCheckout(params: {
  mode: "payment" | "subscription";
  amountCents: number;
  category: string;
  campaignId: number | null;
  serviceSessionId: number | null;
  memberId: number;
  donorEmail: string;
  frequency?: string;
  intentId?: number;
  cashApp?: boolean;
}) {
  if (!stripeConfigured()) {
    return {
      setupRequired: true,
      checkoutUrl: null,
      message: "Online giving is not available right now. Please use another giving method or contact the finance team.",
    };
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const body = new URLSearchParams({
    mode: params.mode,
    success_url: `${appBaseUrl}/member/give?checkout=success`,
    cancel_url: `${appBaseUrl}/member/give?checkout=cancelled`,
    customer_email: params.donorEmail,
    "metadata[member_id]": String(params.memberId),
    "metadata[giving_category]": params.category,
    "metadata[campaign_id]": params.campaignId ? String(params.campaignId) : "",
    "metadata[service_session_id]": params.serviceSessionId ? String(params.serviceSessionId) : "",
    "metadata[giving_intent_id]": params.intentId ? String(params.intentId) : "",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(params.amountCents),
    "line_items[0][price_data][product_data][name]": `Church OS Giving - ${params.category.replace(/_/g, " ")}`,
  });

  if (params.cashApp) {
    // Cash App Pay via Stripe: one-time payments only
    body.set("payment_method_types[0]", "cashapp");
  }

  if (params.mode === "subscription") {
    const interval = params.frequency === "yearly" ? "year" : params.frequency === "weekly" || params.frequency === "biweekly" ? "week" : "month";
    body.set("line_items[0][price_data][recurring][interval]", interval);
    if (params.frequency === "biweekly") body.set("line_items[0][price_data][recurring][interval_count]", "2");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json() as { id?: string; url?: string; customer?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "Stripe Checkout failed.");
  return { setupRequired: false, checkoutUrl: data.url ?? null, checkoutSessionId: data.id ?? null };
}

export function validStripeSignature(rawBody: Buffer, signatureHeader: unknown, secret: string) {
  if (typeof signatureHeader !== "string") return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((item) => item.split("=")));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
