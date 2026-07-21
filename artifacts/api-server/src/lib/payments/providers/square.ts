import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function squareBaseUrl() {
  return process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function squareConfigured() {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

// Creates a Square-hosted payment page for an in-person or kiosk gift.
// The order carries the giving intent id as reference_id; the returned
// order id is stored on the intent so the payment webhook can correlate.
export async function createSquarePaymentLink(params: {
  intentId: number;
  amountCents: number;
  category: string;
}) {
  if (!squareConfigured()) {
    return {
      setupRequired: true as const,
      message: "Square is not connected yet. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to enable in-person card giving.",
    };
  }

  const response = await fetch(`${squareBaseUrl()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        reference_id: String(params.intentId),
        line_items: [
          {
            name: `Church OS Giving - ${params.category.replace(/_/g, " ")}`,
            quantity: "1",
            base_price_money: { amount: params.amountCents, currency: "USD" },
          },
        ],
      },
    }),
  });
  const data = await response.json() as {
    payment_link?: { url?: string; order_id?: string };
    errors?: { detail?: string }[];
  };
  if (!response.ok) throw new Error(data.errors?.[0]?.detail ?? "Square payment link creation failed.");
  return {
    setupRequired: false as const,
    url: data.payment_link?.url ?? null,
    orderId: data.payment_link?.order_id ?? null,
  };
}

// Square signs webhooks with HMAC-SHA256(base64) over notificationUrl + rawBody.
export function validSquareSignature(rawBody: Buffer, signatureHeader: unknown, signatureKey: string, notificationUrl: string) {
  if (typeof signatureHeader !== "string") return false;
  const expected = createHmac("sha256", signatureKey).update(notificationUrl + rawBody.toString()).digest("base64");
  if (signatureHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}
