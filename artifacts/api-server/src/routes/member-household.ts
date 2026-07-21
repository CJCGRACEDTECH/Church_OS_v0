import { and, desc, eq, ne, or } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  childGuardianRelationshipsTable,
  childrenTable,
  db,
  householdUpdateRequestsTable,
  parentGuardiansTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function relationshipLabel(value: string | null) {
  if (!value) return "Household";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function requestMemberNameFromRequest(request: { memberFirstName: string; memberLastName: string }) {
  return fullName({ firstName: request.memberFirstName, lastName: request.memberLastName });
}

function isSpouseRelationship(value: string | null | undefined) {
  return value?.toLowerCase() === "spouse";
}

function getPublicBaseUrl(req: Request): string {
  return process.env.APP_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
}

function getMemberInviteUrl(req: Request, email: string): string {
  return `${getPublicBaseUrl(req).replace(/\/$/, "")}/sign-in?invite=member&email=${encodeURIComponent(email)}`;
}

async function sendMemberInviteEmail(params: {
  to: string;
  name: string;
  inviteUrl: string;
}) {
  const from = process.env.INVITE_EMAIL_FROM ?? "Church OS <no-reply@churchos.local>";
  const subject = "You're invited to open your Church OS account";
  const text = [
    `Hi ${params.name},`,
    "",
    "Your church profile has been approved in Church OS.",
    `Open this link and sign in with this email address to activate your account: ${params.inviteUrl}`,
    "",
    "If you were not expecting this invitation, please contact church administration.",
  ].join("\n");

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: params.to, subject, text }),
    });

    if (!response.ok) {
      throw new Error("Member invitation email provider rejected the message.");
    }
    return;
  }

  logger.info({ email: params.to, inviteUrl: params.inviteUrl }, "Connect form member invitation email fallback");
}

async function getInboxRequestForChurch(requestId: number, churchId: number) {
  const [request] = await db
    .select({
      id: householdUpdateRequestsTable.id,
      memberId: householdUpdateRequestsTable.memberId,
      requestType: householdUpdateRequestsTable.requestType,
      memberFirstName: usersTable.firstName,
      memberLastName: usersTable.lastName,
      memberEmail: usersTable.email,
      memberPhoneNumber: usersTable.phoneNumber,
      memberEmergencyContactName: usersTable.emergencyContactName,
      memberEmergencyContactPhoneNumber: usersTable.emergencyContactPhoneNumber,
      memberEmergencyContactRelationship: usersTable.emergencyContactRelationship,
    })
    .from(householdUpdateRequestsTable)
    .innerJoin(usersTable, eq(householdUpdateRequestsTable.memberId, usersTable.id))
    .where(and(
      eq(householdUpdateRequestsTable.id, requestId),
      eq(householdUpdateRequestsTable.churchId, churchId),
      eq(usersTable.churchId, churchId),
    ));

  return request ?? null;
}

router.get("/member/household", requireAuth, async (req, res): Promise<void> => {
  const [member] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, req.localUserId), eq(usersTable.churchId, req.localChurchId)));

  if (!member) {
    res.status(404).json({ error: "Member not found." });
    return;
  }

  const householdMembers: Array<{ id: number; firstName: string; lastName: string; preferredName: string | null; email: string; phoneNumber: string | null; profilePhotoUrl: string | null; relationship: string | null; memberStatus: typeof usersTable.$inferSelect.memberStatus }> = [];

  const linkedChildren = await db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      dateOfBirth: childrenTable.dateOfBirth,
      gender: childrenTable.gender,
      profilePhotoUrl: childrenTable.profilePhotoUrl,
      classroom: childrenTable.classroom,
      checkinStatus: childrenTable.checkinStatus,
      guardianName: parentGuardiansTable.name,
      guardianEmail: parentGuardiansTable.email,
      guardianPhoneNumber: parentGuardiansTable.phoneNumber,
      relationship: childGuardianRelationshipsTable.relationship,
      authorizedPickup: childGuardianRelationshipsTable.authorizedPickup,
    })
    .from(childGuardianRelationshipsTable)
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(and(
      eq(childrenTable.churchId, req.localChurchId),
      eq(parentGuardiansTable.memberId, member.id),
    ))
    .orderBy(childrenTable.lastName, childrenTable.firstName);

  const updateRequests = await db
    .select({
      id: householdUpdateRequestsTable.id,
      requestType: householdUpdateRequestsTable.requestType,
      message: householdUpdateRequestsTable.message,
      status: householdUpdateRequestsTable.status,
      createdAt: householdUpdateRequestsTable.createdAt,
    })
    .from(householdUpdateRequestsTable)
    .where(and(
      eq(householdUpdateRequestsTable.churchId, req.localChurchId),
      eq(householdUpdateRequestsTable.memberId, req.localUserId),
    ))
    .orderBy(desc(householdUpdateRequestsTable.createdAt))
    .limit(5);

  res.json({
    household: {
      primaryMember: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        preferredName: member.preferredName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        profilePhotoUrl: member.profilePhotoUrl,
      },
      address: {
        streetAddress: member.streetAddress,
        apartmentUnit: member.apartmentUnit,
        city: member.city,
        state: member.state,
        zipCode: member.zipCode,
        country: member.country,
      },
      emergencyContact: {
        name: member.emergencyContactName,
        phoneNumber: member.emergencyContactPhoneNumber,
        relationship: member.emergencyContactRelationship,
      },
      members: householdMembers.map((person) => ({
        ...person,
        relationship: relationshipLabel(person.relationship),
      })),
      children: linkedChildren.map((child) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        profilePhotoUrl: child.profilePhotoUrl,
        classroom: child.classroom,
        checkinStatus: child.checkinStatus,
        guardianName: child.guardianName,
        guardianEmail: child.guardianEmail,
        guardianPhoneNumber: child.guardianPhoneNumber,
        relationship: child.relationship,
        authorizedPickup: child.authorizedPickup,
      })),
      updateRequests: updateRequests.map((request) => ({
        id: request.id,
        requestType: request.requestType,
        message: request.message,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
      })),
    },
  });
});

router.post("/member/household/update-request", requireAuth, async (req, res): Promise<void> => {
  const requestType = textOrNull(req.body?.requestType);
  const message = textOrNull(req.body?.message);

  if (!requestType || !message) {
    res.status(400).json({ error: "Request type and message are required." });
    return;
  }

  if (message.length > 1000) {
    res.status(400).json({ error: "Please keep the request under 1000 characters." });
    return;
  }

  const [request] = await db
    .insert(householdUpdateRequestsTable)
    .values({
      memberId: req.localUserId,
      churchId: req.localChurchId,
      requestType,
      message,
      status: "submitted",
    })
    .returning({
      id: householdUpdateRequestsTable.id,
      status: householdUpdateRequestsTable.status,
      requestType: householdUpdateRequestsTable.requestType,
      createdAt: householdUpdateRequestsTable.createdAt,
    });

  res.status(202).json({
    request: {
      id: request.id,
      status: request.status,
      requestType,
      submittedAt: request.createdAt.toISOString(),
    },
  });
});

const HOUSEHOLD_REQUEST_STATUSES = new Set(["submitted", "reviewing", "completed", "declined"]);

router.get("/admin/household-requests", requireSuperAdmin, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const requests = await db
    .select({
      id: householdUpdateRequestsTable.id,
      requestType: householdUpdateRequestsTable.requestType,
      message: householdUpdateRequestsTable.message,
      status: householdUpdateRequestsTable.status,
      reviewedAt: householdUpdateRequestsTable.reviewedAt,
      createdAt: householdUpdateRequestsTable.createdAt,
      updatedAt: householdUpdateRequestsTable.updatedAt,
      memberId: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
      streetAddress: usersTable.streetAddress,
      apartmentUnit: usersTable.apartmentUnit,
      city: usersTable.city,
      state: usersTable.state,
      zipCode: usersTable.zipCode,
      emergencyContactName: usersTable.emergencyContactName,
      emergencyContactPhoneNumber: usersTable.emergencyContactPhoneNumber,
      emergencyContactRelationship: usersTable.emergencyContactRelationship,
    })
    .from(householdUpdateRequestsTable)
    .innerJoin(usersTable, eq(householdUpdateRequestsTable.memberId, usersTable.id))
    .where(and(
      eq(householdUpdateRequestsTable.churchId, req.localChurchId),
      HOUSEHOLD_REQUEST_STATUSES.has(status) ? eq(householdUpdateRequestsTable.status, status as typeof householdUpdateRequestsTable.$inferSelect.status) : undefined,
    ))
    .orderBy(desc(householdUpdateRequestsTable.createdAt));

  res.json({
    requests: requests.map((request) => ({
      id: request.id,
      source: request.requestType === "connect_form" ? "connect_form" as const : "request" as const,
      requestType: request.requestType,
      message: request.message,
      status: request.status,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      member: {
        id: request.memberId,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        phoneNumber: request.phoneNumber,
        streetAddress: request.streetAddress,
        apartmentUnit: request.apartmentUnit,
        city: request.city,
        state: request.state,
        zipCode: request.zipCode,
        emergencyContactName: request.emergencyContactName,
        emergencyContactPhoneNumber: request.emergencyContactPhoneNumber,
        emergencyContactRelationship: request.emergencyContactRelationship,
      },
    })),
  });
});

router.post("/admin/connect-submissions/:id/approve-invite", requireSuperAdmin, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId)) {
    res.status(400).json({ error: "Invalid Connect submission." });
    return;
  }

  const [member] = await db
    .select({
      id: usersTable.id,
      churchId: usersTable.churchId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
      profileStatus: usersTable.profileStatus,
      inviteAcceptedAt: usersTable.inviteAcceptedAt,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.id, memberId),
      eq(usersTable.churchId, req.localChurchId),
      eq(usersTable.role, "member"),
    ));

  if (!member) {
    res.status(404).json({ error: "Connect submission not found." });
    return;
  }

  if (!member.email?.includes("@")) {
    res.status(400).json({ error: "This Connect submission needs a valid email address before an invite can be sent." });
    return;
  }

  if (member.inviteAcceptedAt) {
    res.status(409).json({ error: "This member has already accepted an invite." });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(usersTable)
    .set({
      memberStatus: "member",
      profileStatus: "approved_member",
      accountStatus: "active",
      isActive: true,
      invitedAt: now,
      approvedAt: now,
    })
    .where(and(
      eq(usersTable.id, member.id),
      eq(usersTable.churchId, req.localChurchId),
      eq(usersTable.role, "member"),
    ))
    .returning({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      invitedAt: usersTable.invitedAt,
      profileStatus: usersTable.profileStatus,
    });

  const inviteUrl = getMemberInviteUrl(req, updated.email);
  try {
    await sendMemberInviteEmail({
      to: updated.email,
      name: `${updated.firstName} ${updated.lastName}`,
      inviteUrl,
    });
  } catch {
    res.status(502).json({ error: "The member was approved, but the invitation email could not be sent. Check email provider settings." });
    return;
  }

  res.json({
    member: {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      invitedAt: updated.invitedAt?.toISOString() ?? null,
      profileStatus: updated.profileStatus,
    },
    inviteSent: true,
    inviteUrl,
  });
});

router.post("/admin/household-requests/:id/apply-update", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    res.status(400).json({ error: "Valid request is required." });
    return;
  }

  const [request] = await db
    .select({
      id: householdUpdateRequestsTable.id,
      status: householdUpdateRequestsTable.status,
      memberId: householdUpdateRequestsTable.memberId,
      requestType: householdUpdateRequestsTable.requestType,
      memberChurchId: usersTable.churchId,
    })
    .from(householdUpdateRequestsTable)
    .innerJoin(usersTable, eq(householdUpdateRequestsTable.memberId, usersTable.id))
    .where(and(
      eq(householdUpdateRequestsTable.id, requestId),
      eq(householdUpdateRequestsTable.churchId, req.localChurchId),
    ));

  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  if (request.requestType === "prayer_request") {
    res.status(400).json({ error: "Prayer requests can be reviewed, but they do not update household records." });
    return;
  }

  const patch = {
    phoneNumber: textOrNull(req.body?.phoneNumber),
    streetAddress: textOrNull(req.body?.streetAddress),
    apartmentUnit: textOrNull(req.body?.apartmentUnit),
    city: textOrNull(req.body?.city),
    state: textOrNull(req.body?.state),
    zipCode: textOrNull(req.body?.zipCode),
    emergencyContactName: textOrNull(req.body?.emergencyContactName),
    emergencyContactPhoneNumber: textOrNull(req.body?.emergencyContactPhoneNumber),
    emergencyContactRelationship: textOrNull(req.body?.emergencyContactRelationship),
  };

  await db
    .update(usersTable)
    .set(patch)
    .where(and(
      eq(usersTable.id, request.memberId),
      eq(usersTable.churchId, req.localChurchId),
    ));

  const [updatedRequest] = await db
    .update(householdUpdateRequestsTable)
    .set({
      status: "completed",
      reviewedByUserId: req.localUserId,
      reviewedAt: new Date(),
    })
    .where(and(
      eq(householdUpdateRequestsTable.id, request.id),
      eq(householdUpdateRequestsTable.churchId, req.localChurchId),
    ))
    .returning({
      id: householdUpdateRequestsTable.id,
      status: householdUpdateRequestsTable.status,
      reviewedAt: householdUpdateRequestsTable.reviewedAt,
    });

  res.json({
    request: {
      id: updatedRequest.id,
      status: updatedRequest.status,
      reviewedAt: updatedRequest.reviewedAt?.toISOString() ?? null,
    },
  });
});

router.get("/admin/household-requests/:id/child-links", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    res.status(400).json({ error: "Valid request is required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  const linkedChildren = await db
    .select({
      relationshipId: childGuardianRelationshipsTable.id,
      childId: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      classroom: childrenTable.classroom,
      relationship: childGuardianRelationshipsTable.relationship,
      authorizedPickup: childGuardianRelationshipsTable.authorizedPickup,
    })
    .from(childGuardianRelationshipsTable)
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(and(
      eq(childrenTable.churchId, req.localChurchId),
      eq(parentGuardiansTable.churchId, req.localChurchId),
      or(
        eq(parentGuardiansTable.email, request.memberEmail),
        request.memberPhoneNumber ? eq(parentGuardiansTable.phoneNumber, request.memberPhoneNumber) : undefined,
      ),
    ))
    .orderBy(childrenTable.lastName, childrenTable.firstName);

  const requestMemberName = fullName({
    firstName: request.memberFirstName,
    lastName: request.memberLastName,
  });
  const linkedSpouses = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
      profilePhotoUrl: usersTable.profilePhotoUrl,
      emergencyContactName: usersTable.emergencyContactName,
      emergencyContactPhoneNumber: usersTable.emergencyContactPhoneNumber,
      emergencyContactRelationship: usersTable.emergencyContactRelationship,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, req.localChurchId),
      eq(usersTable.role, "member"),
      ne(usersTable.id, request.memberId),
      or(
        and(
          eq(usersTable.emergencyContactRelationship, "spouse"),
          or(
            eq(usersTable.emergencyContactName, requestMemberName),
            request.memberPhoneNumber ? eq(usersTable.emergencyContactPhoneNumber, request.memberPhoneNumber) : undefined,
          ),
        ),
        isSpouseRelationship(request.memberEmergencyContactRelationship)
          ? or(
            request.memberEmergencyContactPhoneNumber ? eq(usersTable.phoneNumber, request.memberEmergencyContactPhoneNumber) : undefined,
            request.memberEmergencyContactName ? eq(usersTable.emergencyContactName, request.memberEmergencyContactName) : undefined,
          )
          : undefined,
      ),
    ))
    .orderBy(usersTable.lastName, usersTable.firstName);

  const children = await db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      classroom: childrenTable.classroom,
    })
    .from(childrenTable)
    .where(eq(childrenTable.churchId, req.localChurchId))
    .orderBy(childrenTable.lastName, childrenTable.firstName);

  const members = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, req.localChurchId),
      eq(usersTable.role, "member"),
      ne(usersTable.id, request.memberId),
    ))
    .orderBy(usersTable.lastName, usersTable.firstName);

  res.json({
    linkedChildren,
    linkedSpouses: linkedSpouses.map((spouse) => ({
      id: spouse.id,
      firstName: spouse.firstName,
      lastName: spouse.lastName,
      email: spouse.email,
      phoneNumber: spouse.phoneNumber,
      profilePhotoUrl: spouse.profilePhotoUrl,
    })),
    children: children.map((child) => ({
      ...child,
      name: `${child.firstName} ${child.lastName}`,
    })),
    members: members.map((member) => ({
      ...member,
      name: fullName(member),
    })),
  });
});

router.post("/admin/household-requests/:id/spouse-link", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const spouseMemberId = Number(req.body?.spouseMemberId);
  if (!Number.isInteger(requestId) || !Number.isInteger(spouseMemberId)) {
    res.status(400).json({ error: "Valid request and spouse member are required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  if (request.memberId === spouseMemberId) {
    res.status(400).json({ error: "A member cannot be linked as their own spouse." });
    return;
  }

  const [spouse] = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.id, spouseMemberId),
      eq(usersTable.churchId, req.localChurchId),
      eq(usersTable.role, "member"),
    ));

  if (!spouse) {
    res.status(404).json({ error: "Spouse member not found." });
    return;
  }

  await db
    .update(usersTable)
    .set({
      maritalStatus: "married",
      emergencyContactName: fullName(spouse),
      emergencyContactPhoneNumber: spouse.phoneNumber,
      emergencyContactRelationship: "spouse",
    })
    .where(and(eq(usersTable.id, request.memberId), eq(usersTable.churchId, req.localChurchId)));

  await db
    .update(usersTable)
    .set({
      maritalStatus: "married",
      emergencyContactName: requestMemberNameFromRequest(request),
      emergencyContactPhoneNumber: request.memberPhoneNumber,
      emergencyContactRelationship: "spouse",
    })
    .where(and(eq(usersTable.id, spouse.id), eq(usersTable.churchId, req.localChurchId)));

  res.status(201).json({ ok: true });
});

router.delete("/admin/household-requests/:id/spouse-link/:spouseMemberId", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const spouseMemberId = Number(req.params.spouseMemberId);
  if (!Number.isInteger(requestId) || !Number.isInteger(spouseMemberId)) {
    res.status(400).json({ error: "Valid request and spouse member are required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  await db
    .update(usersTable)
    .set({
      emergencyContactName: null,
      emergencyContactPhoneNumber: null,
      emergencyContactRelationship: null,
    })
    .where(and(eq(usersTable.id, request.memberId), eq(usersTable.churchId, req.localChurchId)));

  await db
    .update(usersTable)
    .set({
      emergencyContactName: null,
      emergencyContactPhoneNumber: null,
      emergencyContactRelationship: null,
    })
    .where(and(eq(usersTable.id, spouseMemberId), eq(usersTable.churchId, req.localChurchId)));

  res.status(204).send();
});

router.post("/admin/household-requests/:id/child-links", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const childId = Number(req.body?.childId);
  const relationship = typeof req.body?.relationship === "string" && ["parent", "guardian", "emergency_contact"].includes(req.body.relationship)
    ? req.body.relationship as "parent" | "guardian" | "emergency_contact"
    : "guardian";
  const authorizedPickup = req.body?.authorizedPickup !== false;

  if (!Number.isInteger(requestId) || !Number.isInteger(childId)) {
    res.status(400).json({ error: "Valid request and child are required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  const [child] = await db
    .select({ id: childrenTable.id })
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, req.localChurchId)));
  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  const guardianFilters = [
    eq(parentGuardiansTable.churchId, req.localChurchId),
    or(
      eq(parentGuardiansTable.email, request.memberEmail),
      request.memberPhoneNumber ? eq(parentGuardiansTable.phoneNumber, request.memberPhoneNumber) : undefined,
    ),
  ];
  const [existingGuardian] = await db
    .select()
    .from(parentGuardiansTable)
    .where(and(...guardianFilters));

  const guardian = existingGuardian ?? (await db
    .insert(parentGuardiansTable)
    .values({
      churchId: req.localChurchId,
      name: `${request.memberFirstName} ${request.memberLastName}`,
      email: request.memberEmail,
      phoneNumber: request.memberPhoneNumber,
    })
    .returning())[0];

  const [existingRelationship] = await db
    .select({ id: childGuardianRelationshipsTable.id })
    .from(childGuardianRelationshipsTable)
    .where(and(
      eq(childGuardianRelationshipsTable.childId, childId),
      eq(childGuardianRelationshipsTable.guardianId, guardian.id),
    ));

  if (existingRelationship) {
    await db
      .update(childGuardianRelationshipsTable)
      .set({ relationship, authorizedPickup })
      .where(eq(childGuardianRelationshipsTable.id, existingRelationship.id));
  } else {
    await db
      .insert(childGuardianRelationshipsTable)
      .values({
        childId,
        guardianId: guardian.id,
        relationship,
        authorizedPickup,
      });
  }

  res.status(201).json({ ok: true });
});

router.patch("/admin/household-requests/:id/child-links/:relationshipId", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const relationshipId = Number(req.params.relationshipId);
  const relationship = typeof req.body?.relationship === "string" && ["parent", "guardian", "emergency_contact"].includes(req.body.relationship)
    ? req.body.relationship as "parent" | "guardian" | "emergency_contact"
    : null;
  const authorizedPickup = typeof req.body?.authorizedPickup === "boolean" ? req.body.authorizedPickup : null;

  if (!Number.isInteger(requestId) || !Number.isInteger(relationshipId)) {
    res.status(400).json({ error: "Valid request and child link are required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  const [existing] = await db
    .select({ id: childGuardianRelationshipsTable.id })
    .from(childGuardianRelationshipsTable)
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(and(
      eq(childGuardianRelationshipsTable.id, relationshipId),
      eq(childrenTable.churchId, req.localChurchId),
      eq(parentGuardiansTable.churchId, req.localChurchId),
      or(
        eq(parentGuardiansTable.email, request.memberEmail),
        request.memberPhoneNumber ? eq(parentGuardiansTable.phoneNumber, request.memberPhoneNumber) : undefined,
      ),
    ));

  if (!existing) {
    res.status(404).json({ error: "Child link not found." });
    return;
  }

  await db
    .update(childGuardianRelationshipsTable)
    .set({
      ...(relationship ? { relationship } : {}),
      ...(authorizedPickup === null ? {} : { authorizedPickup }),
    })
    .where(eq(childGuardianRelationshipsTable.id, relationshipId));

  res.json({ ok: true });
});

router.delete("/admin/household-requests/:id/child-links/:relationshipId", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const relationshipId = Number(req.params.relationshipId);
  if (!Number.isInteger(requestId) || !Number.isInteger(relationshipId)) {
    res.status(400).json({ error: "Valid request and child link are required." });
    return;
  }

  const request = await getInboxRequestForChurch(requestId, req.localChurchId);
  if (!request) {
    res.status(404).json({ error: "Inbox request not found." });
    return;
  }

  const [existing] = await db
    .select({ id: childGuardianRelationshipsTable.id })
    .from(childGuardianRelationshipsTable)
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(and(
      eq(childGuardianRelationshipsTable.id, relationshipId),
      eq(childrenTable.churchId, req.localChurchId),
      eq(parentGuardiansTable.churchId, req.localChurchId),
      or(
        eq(parentGuardiansTable.email, request.memberEmail),
        request.memberPhoneNumber ? eq(parentGuardiansTable.phoneNumber, request.memberPhoneNumber) : undefined,
      ),
    ));

  if (!existing) {
    res.status(404).json({ error: "Child link not found." });
    return;
  }

  await db
    .delete(childGuardianRelationshipsTable)
    .where(eq(childGuardianRelationshipsTable.id, relationshipId));

  res.status(204).send();
});

router.patch("/admin/household-requests/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const requestId = Number(req.params.id);
  const status = typeof req.body?.status === "string" ? req.body.status : "";

  if (!Number.isInteger(requestId) || !HOUSEHOLD_REQUEST_STATUSES.has(status)) {
    res.status(400).json({ error: "Valid request and status are required." });
    return;
  }

  const [request] = await db
    .update(householdUpdateRequestsTable)
    .set({
      status: status as typeof householdUpdateRequestsTable.$inferSelect.status,
      reviewedByUserId: req.localUserId,
      reviewedAt: status === "submitted" ? null : new Date(),
    })
    .where(and(
      eq(householdUpdateRequestsTable.id, requestId),
      eq(householdUpdateRequestsTable.churchId, req.localChurchId),
    ))
    .returning({
      id: householdUpdateRequestsTable.id,
      status: householdUpdateRequestsTable.status,
      reviewedAt: householdUpdateRequestsTable.reviewedAt,
    });

  if (!request) {
    res.status(404).json({ error: "Household request not found." });
    return;
  }

  res.json({
    request: {
      id: request.id,
      status: request.status,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    },
  });
});

export default router;
