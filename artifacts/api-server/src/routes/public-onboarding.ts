import { and, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  churchesTable,
  db,
  eventsTable,
  householdUpdateRequestsTable,
  sermonsTable,
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
    res.status(201).json({ message: "Thank you for connecting with us.", profile: { firstName, churchName: church.name } });
    return;
  }

  let profileId: number;

  if (duplicate?.churchId === church.id && duplicate.role === "member") {
    profileId = duplicate.id;
  } else {
    const smallGroup = discipleshipInterest === true ? "[disciple-interest]" : null;
    const [created] = await db
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
      .returning({ id: usersTable.id });
    profileId = created.id;
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
      memberId: profileId,
      requestType: "connect_form",
      message,
      status: "submitted",
    });

  res.status(201).json({
    message: "Thank you for connecting with us.",
    profile: {
      firstName,
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
    res.status(202).json({ message: "Your account request was received.", request: { firstName, churchName: church.name } });
    return;
  }

  let profileId: number;
  let matchNote: string;

  const sameChurchMatch = matchedByEmail?.churchId === church.id && matchedByEmail.role === "member"
    ? matchedByEmail
    : null;

  if (sameChurchMatch) {
    profileId = sameChurchMatch.id;
    matchNote = `Possible existing member match: ${sameChurchMatch.firstName} ${sameChurchMatch.lastName}`;
  } else if (phoneNumber) {
    const [matchedByPhone] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(usersTable)
      .where(and(eq(usersTable.churchId, church.id), eq(usersTable.role, "member"), eq(usersTable.phoneNumber, phoneNumber)));

    if (matchedByPhone) {
      profileId = matchedByPhone.id;
      matchNote = `Possible existing member match by phone: ${matchedByPhone.firstName} ${matchedByPhone.lastName}`;
    } else {
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
        .returning({ id: usersTable.id });
      profileId = created.id;
      matchNote = "No existing member match found";
    }
  } else {
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
      .returning({ id: usersTable.id });
    profileId = created.id;
    matchNote = "No existing member match found";
  }

  const message = [
    "Member account access requested.",
    "",
    `Match status: ${matchNote}`,
    preferredContactMethod ? `Preferred contact: ${preferredContactMethod}` : null,
    reason ? `Reason: ${reason}` : null,
  ].filter(Boolean).join("\n");

  await db.insert(householdUpdateRequestsTable).values({
    churchId: church.id,
    memberId: profileId,
    requestType: "account_request",
    message,
    status: "submitted",
  });

  res.status(202).json({
    message: "Your account request was received.",
    request: {
      firstName,
      churchName: church.name,
    },
  });
});

router.get("/public/events", async (req, res): Promise<void> => {
  const church = await getDefaultChurch();
  if (!church) {
    res.json({ events: [] });
    return;
  }

  const now = new Date();
  const events = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.churchId, church.id),
        eq(eventsTable.visibility, "public"),
        eq(eventsTable.status, "published"),
        gte(eventsTable.endDatetime, now),
      ),
    )
    .orderBy(eventsTable.startDatetime)
    .limit(20);

  res.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      description: e.description,
      startDatetime: e.startDatetime.toISOString(),
      endDatetime: e.endDatetime.toISOString(),
      location: e.location,
      eventMode: e.eventMode,
      posterUrl: e.posterUrl,
    })),
  });
});

router.get("/public/sermons", async (req, res): Promise<void> => {
  const church = await getDefaultChurch();
  if (!church) {
    res.json({ sermons: [] });
    return;
  }

  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(
      and(
        eq(sermonsTable.churchId, church.id),
        eq(sermonsTable.isPublished, true),
      ),
    )
    .orderBy(desc(sermonsTable.sermonDate))
    .limit(20);

  res.json({
    sermons: sermons.map((s) => ({
      id: s.id,
      title: s.title,
      speakerName: s.speakerName,
      seriesName: s.seriesName,
      description: s.description,
      youtubeVideoId: s.youtubeVideoId,
      thumbnailUrl: `https://img.youtube.com/vi/${s.youtubeVideoId}/hqdefault.jpg`,
      youtubeUrl: `https://www.youtube.com/watch?v=${s.youtubeVideoId}`,
      sermonDate: s.sermonDate.toISOString(),
    })),
  });
});

export default router;
