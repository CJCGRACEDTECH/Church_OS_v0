import { and, desc, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  childGuardianRelationshipsTable,
  childrenTable,
  db,
  householdUpdateRequestsTable,
  parentGuardiansTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function relationshipLabel(value: string | null) {
  if (!value) return "Household";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  const hasFullAddress = !!(
    member.streetAddress &&
    member.city &&
    member.state &&
    member.zipCode
  );

  const householdMembers = hasFullAddress
    ? await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        preferredName: usersTable.preferredName,
        email: usersTable.email,
        phoneNumber: usersTable.phoneNumber,
        profilePhotoUrl: usersTable.profilePhotoUrl,
        relationship: usersTable.emergencyContactRelationship,
        memberStatus: usersTable.memberStatus,
      })
      .from(usersTable)
      .where(and(
        eq(usersTable.churchId, req.localChurchId),
        eq(usersTable.role, "member"),
        ne(usersTable.id, member.id),
        eq(usersTable.streetAddress, member.streetAddress!),
        eq(usersTable.city, member.city!),
        eq(usersTable.state, member.state!),
        eq(usersTable.zipCode, member.zipCode!),
      ))
      .orderBy(usersTable.lastName, usersTable.firstName)
    : [];

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
      },
    })),
  });
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
