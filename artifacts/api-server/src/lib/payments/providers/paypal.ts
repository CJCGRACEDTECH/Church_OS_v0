function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? "PayPal authentication failed.");
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 300) * 1000 };
  return data.access_token;
}

// Creates a PayPal Order carrying the giving intent id as custom_id so the
// webhook (or return-URL capture) can correlate the payment back to it.
// preferVenmo requests Venmo as the funding source; PayPal only honors this
// when the buyer has Venmo linked to their PayPal account and is in the US —
// it is a preference, not a guarantee.
export async function createPaypalOrder(params: {
  intentId: number;
  amountCents: number;
  category: string;
  returnUrl: string;
  cancelUrl: string;
  preferVenmo?: boolean;
}) {
  if (!paypalConfigured()) {
    return {
      setupRequired: true as const,
      message: "PayPal is not connected yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable PayPal giving.",
    };
  }

  const accessToken = await getAccessToken();
  const body: Record<string, unknown> = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: String(params.intentId),
        description: `Church OS Giving - ${params.category.replace(/_/g, " ")}`,
        amount: { currency_code: "USD", value: (params.amountCents / 100).toFixed(2) },
      },
    ],
    application_context: {
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      user_action: "PAY_NOW",
    },
  };
  if (params.preferVenmo) {
    body.payment_source = { venmo: { experience_context: { return_url: params.returnUrl, cancel_url: params.cancelUrl } } };
  }

  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { id?: string; links?: { rel?: string; href?: string }[]; message?: string };
  if (!response.ok) throw new Error(data.message ?? "PayPal order creation failed.");

  const approveLink = data.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href ?? null;
  return { setupRequired: false as const, orderId: data.id ?? null, approveUrl: approveLink };
}

export async function capturePaypalOrder(orderId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  const data = await response.json() as Record<string, unknown> & { message?: string };
  if (!response.ok) throw new Error(data.message ?? "PayPal capture failed.");
  return data;
}

// PayPal's verify-webhook-signature API is the supported verification path
// (their webhook signing scheme uses a rotating cert URL rather than a
// static HMAC secret Church OS can check locally).
export async function validPaypalWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const accessToken = await getAccessToken();
  const verifyBody = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody.toString()),
  };
  const response = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(verifyBody),
  });
  const data = await response.json() as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
