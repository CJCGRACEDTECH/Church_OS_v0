import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  churchesTable,
  db,
  householdUpdateRequestsTable,
  usersTable,
} from "@workspace/db";
import { calculateProfileCompletionPercent } from "../lib/onboarding";

const router: IRouter = Router();

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalBoolValue(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function yesNo(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Yes" : "No";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getDefaultChurch() {
  const slug = process.env.DEFAULT_SIGNUP_CHURCH_SLUG ?? "cjc-international";
  const [church] = await db
    .select({ id: churchesTable.id, name: churchesTable.name })
    .from(churchesTable)
    .where(eq(churchesTable.slug, slug));
  return church ?? null;
}

router.post("/public/connect", async (req, res): Promise<void> => {
  const church = await getDefaultChurch();
  if (!church) {
    res.status(503).json({ error: "Church profile is not configured yet." });
    return;
  }

  const firstName = requiredText(req.body?.firstName);
  const lastName = requiredText(req.body?.lastName);
  const email = normalizeEmail(requiredText(req.body?.email));
  const phoneNumber = textOrNull(req.body?.phoneNumber);
  const preferredLanguage = textOrNull(req.body?.preferredLanguage);
  const preferredContactMethod = textOrNull(req.body?.preferredContactMethod);
  const ministryInterest = textOrNull(req.body?.ministryInterest);
  const discipleshipInterest = optionalBoolValue(req.body?.discipleshipInterest);
  const firstTimeVisitor = optionalBoolValue(req.body?.firstTimeVisitor);
  const interestedInMembership = optionalBoolValue(req.body?.interestedInMembership);
  const wantsContact = optionalBoolValue(req.body?.wantsContact);
  const prayerRequest = textOrNull(req.body?.prayerRequest);

  if (!firstName || !lastName || !email || !phoneNumber) {
    res.status(400).json({ error: "First name, last name, email, and phone are required." });
    return;
  }

  if (!email.includes("@")) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const [duplicate] = await db
    .select({
      id: usersTable.id,
      churchId: usersTable.churchId,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (duplicate && duplicate.churchId !== church.id) {
    res.status(409).json({
      error: "This email is already attached to another Church OS account. Please contact the church office for help.",
    });
    return;
  }

  let profile = duplicate?.churchId === church.id && duplicate.role === "member"
    ? { id: duplicate.id, firstName: duplicate.firstName }
    : null;

  if (!profile) {
    const smallGroup = discipleshipInterest === true ? "[disciple-interest]" : null;
    [profile] = await db
      .insert(usersTable)
      .values({
        churchId: church.id,
        firstName,
        lastName,
        email,
        phoneNumber,
        preferredLanguage,
        preferredContactMethod: preferredContactMethod === "phone" || preferredContactMethod === "text" ? preferredContactMethod : "email",
        ministryDepartment: ministryInterest,
        ministryInterest,
        discipleshipInterest,
        firstTimeVisitor,
        interestedInMembership,
        wantsContact,
        prayerRequest,
        smallGroup,
        memberStatus: "visitor",
        profileStatus: "pending_review",
        profileCompletionPercent: calculateProfileCompletionPercent({
          firstName,
          lastName,
          email,
          phoneNumber,
        }),
        role: "member",
        accountStatus: "pending",
        isActive: false,
      })
      .returning({
        id: usersTable.id,
        firstName: usersTable.firstName,
      });
  }

  const message = [
    "Public Connect form submitted.",
    "",
    yesNo(firstTimeVisitor) ? `First-time visitor: ${yesNo(firstTimeVisitor)}` : null,
    yesNo(interestedInMembership) ? `Interested in membership: ${yesNo(interestedInMembership)}` : null,
    yesNo(wantsContact) ? `Contact requested: ${yesNo(wantsContact)}` : null,
    preferredContactMethod ? `Preferred contact: ${preferredContactMethod}` : null,
    preferredLanguage ? `Preferred language: ${preferredLanguage}` : null,
    ministryInterest ? `Ministry interest: ${ministryInterest}` : null,
    yesNo(discipleshipInterest) ? `Discipleship interest: ${yesNo(discipleshipInterest)}` : null,
    prayerRequest ? `Prayer request / message: ${prayerRequest}` : null,
  ].filter(Boolean).join("\n");

  await db
    .insert(householdUpdateRequestsTable)
    .values({
      churchId: church.id,
      memberId: profile.id,
      requestType: "connect_form",
      message,
      status: "submitted",
    });

  res.status(201).json({
    message: "Thank you for connecting with us.",
    profile: {
      id: profile.id,
      firstName: profile.firstName,
      churchName: church.name,
    },
  });
});

router.post("/public/account-request", async (req, res): Promise<void> => {
  const church = await getDefaultChurch();
  if (!church) {
    res.status(503).json({ error: "Church profile is not configured yet." });
    return;
  }

  const firstName = requiredText(req.body?.firstName);
  const lastName = requiredText(req.body?.lastName);
  const email = normalizeEmail(requiredText(req.body?.email));
  const phoneNumber = textOrNull(req.body?.phoneNumber);
  const preferredContactMethod = textOrNull(req.body?.preferredContactMethod);
  const reason = textOrNull(req.body?.reason);

  if (!firstName || !lastName || !email || !phoneNumber) {
    res.status(400).json({ error: "First name, last name, email, and phone are required." });
    return;
  }

  if (!email.includes("@")) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const [matchedByEmail] = await db
    .select({
      id: usersTable.id,
      churchId: usersTable.churchId,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (matchedByEmail && matchedByEmail.churchId !== church.id) {
    res.status(409).json({ error: "This email is already attached to another Church OS account. Please contact the church office for help." });
    return;
  }

  let profile = matchedByEmail?.churchId === church.id && matchedByEmail.role === "member"
    ? { id: matchedByEmail.id, firstName: matchedByEmail.firstName, lastName: matchedByEmail.lastName, matched: true }
    : null;

  if (!profile && phoneNumber) {
    const [matchedByPhone] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(usersTable)
      .where(and(eq(usersTable.churchId, church.id), eq(usersTable.role, "member"), eq(usersTable.phoneNumber, phoneNumber)));

    if (matchedByPhone) {
      profile = { id: matchedByPhone.id, firstName: matchedByPhone.firstName, lastName: matchedByPhone.lastName, matched: true };
    }
  }

  if (!profile) {
    const [created] = await db
      .insert(usersTable)
      .values({
        churchId: church.id,
        firstName,
        lastName,
        email,
        phoneNumber,
        preferredContactMethod: preferredContactMethod === "phone" || preferredContactMethod === "text" ? preferredContactMethod : "email",
        memberStatus: "visitor",
        profileStatus: "pending_review",
        profileCompletionPercent: calculateProfileCompletionPercent({ firstName, lastName, email, phoneNumber }),
        role: "member",
        accountStatus: "pending",
        isActive: false,
      })
      .returning({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      });
    profile = { ...created, matched: false };
  }

  const message = [
    "Member account access requested.",
    "",
    `Match status: ${profile.matched ? `Possible existing member match: ${profile.firstName} ${profile.lastName}` : "No existing member match found"}`,
    preferredContactMethod ? `Preferred contact: ${preferredContactMethod}` : null,
    reason ? `Reason: ${reason}` : null,
  ].filter(Boolean).join("\n");

  await db.insert(householdUpdateRequestsTable).values({
    churchId: church.id,
    memberId: profile.id,
    requestType: "account_request",
    message,
    status: "submitted",
  });

  res.status(202).json({
    message: "Your account request was received.",
    request: {
      firstName,
      churchName: church.name,
      matchedExistingProfile: profile.matched,
    },
  });
});

export default router;
