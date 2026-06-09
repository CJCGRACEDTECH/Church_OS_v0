import twilio from "twilio";
import { logger } from "./logger";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export const SMS_ENABLED = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_PHONE_NUMBER,
);

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!SMS_ENABLED) {
    logger.warn("SMS not configured — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER required");
    return { ok: false, error: "SMS not configured" };
  }
  const client = getClient();
  if (!client) return { ok: false, error: "SMS client unavailable" };
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown SMS error";
    logger.error({ err, to }, "SMS send failed");
    return { ok: false, error: msg };
  }
}

export function formatFollowUpMessage(memberName: string, sessionName: string, churchName = "CJC Church"): string {
  return `Hi ${memberName}, this is a follow-up from ${churchName}. We noticed you missed ${sessionName} and wanted to check in. Reply STOP to opt out.`;
}

export function formatCheckInConfirmation(memberName: string, sessionName: string, churchName = "CJC Church"): string {
  return `Hi ${memberName}! Your attendance for ${sessionName} has been recorded. See you next time — ${churchName}.`;
}
