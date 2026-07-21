import { and, eq, gte } from "drizzle-orm";
import { db, donationsTable, givingIntentsTable, memberPaymentAliasesTable, usersTable, type MemberPaymentAlias } from "@workspace/db";

export const AUTO_MATCH_THRESHOLD = 90;
export const SUGGEST_THRESHOLD = 40;

export type CandidateTx = {
  amountCents: number;
  date: Date;
  senderName?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | null;
  senderHandle?: string | null;
  memo?: string | null;
};

type MemberLite = { id: number; firstName: string; lastName: string; email: string; phoneNumber: string | null };
type RecentDonation = { memberId: number | null; amountCents: number };

export type MatchInput = {
  members: MemberLite[];
  aliases: MemberPaymentAlias[];
  recentDonations?: RecentDonation[];
};

export type MatchResult = { memberId: number; confidence: number; reasons: string[] };

export function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeAliasValueFor(aliasType: string, value: string) {
  return aliasType === "zelle_phone" ? normalizePhone(value) : normalizeText(value);
}

// Pure scoring — no DB access. Returns candidates ranked highest-confidence
// first, capped at 100. Caller decides what to do with the scores
// (auto-match >= AUTO_MATCH_THRESHOLD, suggest >= SUGGEST_THRESHOLD, else none).
export function scoreMatches(tx: CandidateTx, input: MatchInput): MatchResult[] {
  const scores = new Map<number, { confidence: number; reasons: string[] }>();
  const bump = (memberId: number, points: number, reason: string) => {
    const entry = scores.get(memberId) ?? { confidence: 0, reasons: [] };
    entry.confidence = Math.min(100, entry.confidence + points);
    entry.reasons.push(reason);
    scores.set(memberId, entry);
  };

  const senderEmail = tx.senderEmail ? normalizeText(tx.senderEmail) : null;
  const senderPhone = tx.senderPhone ? normalizePhone(tx.senderPhone) : null;
  const senderHandle = tx.senderHandle ? normalizeText(tx.senderHandle) : null;
  const senderName = tx.senderName ? normalizeText(tx.senderName) : null;
  const memo = tx.memo ? normalizeText(tx.memo) : null;

  for (const alias of input.aliases) {
    const value = alias.normalizedValue;
    if ((senderHandle && value === senderHandle) || (senderEmail && value === senderEmail) || (senderPhone && value === senderPhone.replace(/^1/, "")) || (senderName && value === senderName)) {
      bump(alias.memberId, 95, `Matches saved ${alias.aliasType.replace(/_/g, " ")}`);
    }
  }

  for (const member of input.members) {
    const memberEmail = normalizeText(member.email);
    const memberPhone = member.phoneNumber ? normalizePhone(member.phoneNumber) : null;
    const fullName = normalizeText(`${member.firstName} ${member.lastName}`);
    const lastFirst = normalizeText(`${member.lastName} ${member.firstName[0] ?? ""}`);

    if (senderEmail && senderEmail === memberEmail) bump(member.id, 90, "Email matches member profile");
    if (senderPhone && memberPhone && senderPhone.replace(/^1/, "") === memberPhone.replace(/^1/, "")) bump(member.id, 85, "Phone matches member profile");
    if (senderName === fullName) bump(member.id, 70, "Sender name matches member");
    else if (senderName && normalizeText(member.lastName) && senderName.includes(normalizeText(member.lastName)) && senderName.includes(normalizeText(member.firstName[0] ?? ""))) {
      bump(member.id, 55, "Sender name partially matches member");
    }
    if (memo && fullName && memo.includes(fullName)) bump(member.id, 10, "Memo mentions member name");
    if (input.recentDonations) {
      const priorAmounts = input.recentDonations.filter((d) => d.memberId === member.id).map((d) => d.amountCents);
      if (priorAmounts.includes(tx.amountCents)) bump(member.id, 10, "Amount matches member's recent giving");
    }
  }

  return Array.from(scores.entries())
    .map(([memberId, { confidence, reasons }]) => ({ memberId, confidence, reasons }))
    .sort((a, b) => b.confidence - a.confidence);
}

// DB-backed wrapper: loads church-scoped members/aliases/recent donations
// and runs the pure scorer.
export async function runMatcher(churchId: number, tx: CandidateTx): Promise<MatchResult[]> {
  const members = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    phoneNumber: usersTable.phoneNumber,
  }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member")));

  const aliases = await db.select().from(memberPaymentAliasesTable).where(eq(memberPaymentAliasesTable.churchId, churchId));

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentDonations = await db.select({ memberId: donationsTable.memberId, amountCents: donationsTable.amountCents })
    .from(donationsTable)
    .where(and(eq(donationsTable.churchId, churchId), eq(donationsTable.paymentStatus, "succeeded"), gte(donationsTable.donationDate, ninetyDaysAgo)));

  return scoreMatches(tx, { members, aliases, recentDonations });
}

const NAME_ALIAS_TYPE_BY_METHOD: Record<string, string> = {
  zelle: "zelle_name",
  cash_app: "cashapp_handle",
  venmo: "venmo_username",
  paypal: "paypal_email",
};
const EMAIL_ALIAS_TYPE_BY_METHOD: Record<string, string> = {
  zelle: "zelle_email",
  paypal: "paypal_email",
};

// Permanently remembers every identifier present on a transaction (handle,
// email, phone, sender name) against the member it was matched to, so the
// next payment from any of the same identifiers auto-matches without admin
// involvement. Called every time a transaction is attributed to a member —
// on auto-match and on manual link — not gated behind an opt-in checkbox.
export async function saveAliasesFromTx(params: { churchId: number; memberId: number; method: string; tx: CandidateTx; actorUserId: number | null }) {
  const candidates: { aliasType: string; aliasValue: string }[] = [];

  if (params.tx.senderHandle) {
    const handleType = params.method === "cash_app" ? "cashapp_handle" : params.method === "venmo" ? "venmo_username" : "other";
    candidates.push({ aliasType: handleType, aliasValue: params.tx.senderHandle });
  }
  if (params.tx.senderEmail) {
    candidates.push({ aliasType: EMAIL_ALIAS_TYPE_BY_METHOD[params.method] ?? "zelle_email", aliasValue: params.tx.senderEmail });
  }
  if (params.tx.senderPhone) {
    candidates.push({ aliasType: "zelle_phone", aliasValue: params.tx.senderPhone });
  }
  if (params.tx.senderName) {
    candidates.push({ aliasType: NAME_ALIAS_TYPE_BY_METHOD[params.method] ?? "other", aliasValue: params.tx.senderName });
  }

  for (const candidate of candidates) {
    await db.insert(memberPaymentAliasesTable).values({
      churchId: params.churchId,
      memberId: params.memberId,
      aliasType: candidate.aliasType as MemberPaymentAlias["aliasType"],
      aliasValue: candidate.aliasValue,
      normalizedValue: normalizeAliasValueFor(candidate.aliasType, candidate.aliasValue),
      createdByUserId: params.actorUserId,
    }).onConflictDoNothing();
  }
}

export async function findOpenIntentMatch(churchId: number, tx: CandidateTx) {
  const intents = await db.select().from(givingIntentsTable).where(and(eq(givingIntentsTable.churchId, churchId), eq(givingIntentsTable.status, "pending")));
  const sameDayWindowMs = 24 * 60 * 60 * 1000;
  return intents.find((intent) => intent.amountCents === tx.amountCents && Math.abs(intent.createdAt.getTime() - tx.date.getTime()) <= sameDayWindowMs) ?? null;
}
