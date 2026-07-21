import type { IncomingHttpHeaders } from "node:http";
import type { GivingIntent, PaymentMethod } from "@workspace/db";

export type CheckoutResult =
  | { kind: "redirect"; url: string; providerRef: string }
  | { kind: "terminal"; terminalCheckoutId: string }
  | { kind: "setup_required"; message: string };

export type PaymentEventType =
  | "payment_succeeded"
  | "payment_failed"
  | "refund"
  | "dispute"
  | "subscription_payment"
  | "subscription_cancelled"
  | "checkout_expired"
  | "ignored";

export type PaymentEvent = {
  type: PaymentEventType;
  providerTransactionId: string | null;
  providerCustomerId?: string | null;
  providerReceiptUrl?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  intentId?: number | null;
  memberId?: number | null;
  senderName?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | null;
  memo?: string | null;
  raw: Record<string, unknown>;
  occurredAt?: Date | null;
};

export interface GivingProvider {
  method: PaymentMethod;
  isConfigured(): boolean;
  createCheckout(intent: GivingIntent, opts: { successUrl: string; cancelUrl: string }): Promise<CheckoutResult>;
  verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): Promise<boolean>;
  parseWebhook(rawBody: Buffer): PaymentEvent[];
}
