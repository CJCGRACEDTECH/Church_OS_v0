import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Router, type IRouter } from "express";
import {
  childGuardianRelationshipsTable,
  checkinRecordsTable,
  childrenTable,
  db,
  parentGuardiansTable,
  usersTable,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();
const requireCheckInAccess = requireAdminPermission(ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN);

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRelationship(value: unknown): value is "parent" | "guardian" | "emergency_contact" {
  return value === "parent" || value === "guardian" || value === "emergency_contact";
}

function pickupCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

async function getRequesterChurchId(userId: number) {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return user?.churchId ?? null;
}

async function serializeChild(child: typeof childrenTable.$inferSelect) {
  const guardians = await db
    .select({
      id: parentGuardiansTable.id,
      name: parentGuardiansTable.name,
      email: parentGuardiansTable.email,
      phoneNumber: parentGuardiansTable.phoneNumber,
      relationship: childGuardianRelationshipsTable.relationship,
      authorizedPickup: childGuardianRelationshipsTable.authorizedPickup,
    })
    .from(childGuardianRelationshipsTable)
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(eq(childGuardianRelationshipsTable.childId, child.id));

  const [activeCheckIn] = await db
    .select({
      id: checkinRecordsTable.id,
      checkinTime: checkinRecordsTable.checkinTime,
      classroom: checkinRecordsTable.classroom,
      checkedInByUserId: checkinRecordsTable.checkedInByUserId,
    })
    .from(checkinRecordsTable)
    .where(and(eq(checkinRecordsTable.childId, child.id), eq(checkinRecordsTable.status, "active"), isNull(checkinRecordsTable.checkoutTime)))
    .orderBy(desc(checkinRecordsTable.checkinTime));

  return {
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    dateOfBirth: child.dateOfBirth,
    age: calculateAge(child.dateOfBirth),
    gender: child.gender,
    profilePhotoUrl: child.profilePhotoUrl,
    allergyInformation: child.allergyInformation,
    medicalNotes: child.medicalNotes,
    specialInstructions: child.specialInstructions,
    classroom: child.classroom,
    checkinStatus: child.checkinStatus,
    guardians,
    activeCheckIn: activeCheckIn
      ? {
          ...activeCheckIn,
          checkinTime: activeCheckIn.checkinTime.toISOString(),
        }
      : null,
  };
}

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

router.get("/admin/checkin/children", requireCheckInAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const children = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.churchId, churchId))
    .orderBy(childrenTable.lastName, childrenTable.firstName);

  res.json({ children: await Promise.all(children.map(serializeChild)) });
});

router.get("/admin/checkin/history", requireCheckInAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const checkedOutUserAlias = alias(usersTable, "checked_out_by_user");

  const records = await db
    .select({
      id: checkinRecordsTable.id,
      checkinTime: checkinRecordsTable.checkinTime,
      checkoutTime: checkinRecordsTable.checkoutTime,
      classroom: checkinRecordsTable.classroom,
      status: checkinRecordsTable.status,
      childId: childrenTable.id,
      childFirstName: childrenTable.firstName,
      childLastName: childrenTable.lastName,
      checkedInByFirstName: usersTable.firstName,
      checkedInByLastName: usersTable.lastName,
      checkedOutByFirstName: checkedOutUserAlias.firstName,
      checkedOutByLastName: checkedOutUserAlias.lastName,
      pickedUpByName: parentGuardiansTable.name,
    })
    .from(checkinRecordsTable)
    .innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id))
    .innerJoin(usersTable, eq(checkinRecordsTable.checkedInByUserId, usersTable.id))
    .leftJoin(checkedOutUserAlias, eq(checkinRecordsTable.checkedOutByUserId, checkedOutUserAlias.id))
    .leftJoin(parentGuardiansTable, eq(checkinRecordsTable.pickedUpByGuardianId, parentGuardiansTable.id))
    .where(eq(childrenTable.churchId, churchId))
    .orderBy(desc(checkinRecordsTable.checkinTime))
    .limit(100);

  res.json({
    history: records.map((record) => ({
      id: record.id,
      childId: record.childId,
      childName: `${record.childFirstName} ${record.childLastName}`,
      checkinTime: record.checkinTime.toISOString(),
      checkoutTime: record.checkoutTime ? record.checkoutTime.toISOString() : null,
      classroom: record.classroom,
      status: record.status,
      checkedInByName: `${record.checkedInByFirstName} ${record.checkedInByLastName}`,
      checkedOutByName: record.checkedOutByFirstName && record.checkedOutByLastName
        ? `${record.checkedOutByFirstName} ${record.checkedOutByLastName}`
        : null,
      pickedUpByName: record.pickedUpByName,
    })),
  });
});

router.get("/admin/checkin/member-contacts", requireCheckInAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters = [
    eq(usersTable.churchId, churchId),
    eq(usersTable.role, "member"),
    ...(search
      ? [
          or(
            ilike(usersTable.firstName, `%${search}%`),
            ilike(usersTable.lastName, `%${search}%`),
            ilike(usersTable.email, `%${search}%`),
            ilike(usersTable.phoneNumber, `%${search}%`),
          ),
        ]
      : []),
  ];

  const members = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phoneNumber: usersTable.phoneNumber,
    })
    .from(usersTable)
    .where(and(...filters))
    .orderBy(usersTable.lastName, usersTable.firstName)
    .limit(100);

  res.json({
    members: members.map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      email: member.email,
      phoneNumber: member.phoneNumber,
    })),
  });
});

router.post("/admin/checkin/children", requireCheckInAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const firstName = requiredText(req.body?.firstName);
  const lastName = requiredText(req.body?.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: "Child first and last name are required." });
    return;
  }

  const guardians = normalizeGuardianInputs(req.body);
  if (guardians.length === 0) {
    res.status(400).json({ error: "At least one guardian contact is required to register a child." });
    return;
  }

  const [child] = await db
    .insert(childrenTable)
    .values({
      churchId,
      firstName,
      lastName,
      dateOfBirth: textOrNull(req.body?.dateOfBirth),
      gender: textOrNull(req.body?.gender),
      profilePhotoUrl: textOrNull(req.body?.profilePhotoUrl),
      allergyInformation: textOrNull(req.body?.allergyInformation),
      medicalNotes: textOrNull(req.body?.medicalNotes),
      specialInstructions: textOrNull(req.body?.specialInstructions),
      classroom: textOrNull(req.body?.classroom),
      checkinStatus: "checked_out",
    })
    .returning();

  try {
    for (const guardian of guardians) {
      await createGuardianRelationship({
        churchId,
        childId: child.id,
        memberId: guardian.memberId,
        name: guardian.name,
        email: guardian.email,
        phoneNumber: guardian.phoneNumber,
        relationship: guardian.relationship,
        authorizedPickup: guardian.authorizedPickup,
      });
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not add pickup contacts." });
    return;
  }

  res.status(201).json({ child: await serializeChild(child) });
});

router.patch("/admin/checkin/children/:childId", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const firstName = requiredText(req.body?.firstName);
  const lastName = requiredText(req.body?.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: "Child first and last name are required." });
    return;
  }

  const [child] = await db
    .update(childrenTable)
    .set({
      firstName,
      lastName,
      dateOfBirth: textOrNull(req.body?.dateOfBirth),
      gender: textOrNull(req.body?.gender),
      profilePhotoUrl: textOrNull(req.body?.profilePhotoUrl),
      allergyInformation: textOrNull(req.body?.allergyInformation),
      medicalNotes: textOrNull(req.body?.medicalNotes),
      specialInstructions: textOrNull(req.body?.specialInstructions),
      classroom: textOrNull(req.body?.classroom),
    })
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)))
    .returning();

  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  res.json({ child: await serializeChild(child) });
});

router.post("/admin/checkin/children/:childId/guardians", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)));

  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  try {
    await createGuardianRelationship({
      churchId,
      childId,
      name: req.body?.name,
      email: req.body?.email,
      phoneNumber: req.body?.phoneNumber,
      relationship: req.body?.relationship,
      authorizedPickup: req.body?.authorizedPickup,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not add pickup contact." });
    return;
  }

  res.status(201).json({ child: await serializeChild(child) });
});

router.post("/admin/checkin/children/:childId/check-in", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)));

  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  if (child.checkinStatus === "checked_in") {
    res.status(409).json({ error: "Child is already checked in." });
    return;
  }

  const classroom = textOrNull(req.body?.classroom) ?? child.classroom;
  await db.insert(checkinRecordsTable).values({
    childId,
    checkedInByUserId: req.localUserId,
    classroom,
    pickupCode: pickupCode(),
    status: "active",
  });

  const [updatedChild] = await db
    .update(childrenTable)
    .set({ checkinStatus: "checked_in", classroom })
    .where(eq(childrenTable.id, childId))
    .returning();

  res.json({ child: await serializeChild(updatedChild) });
});

router.post("/admin/checkin/children/:childId/check-out", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const guardianId = Number(req.body?.guardianId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !Number.isInteger(guardianId) || !churchId) {
    res.status(400).json({ error: "Child and pickup person are required." });
    return;
  }

  const [relationship] = await db
    .select({ id: childGuardianRelationshipsTable.id })
    .from(childGuardianRelationshipsTable)
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .where(
      and(
        eq(childGuardianRelationshipsTable.childId, childId),
        eq(childGuardianRelationshipsTable.guardianId, guardianId),
        eq(childGuardianRelationshipsTable.authorizedPickup, true),
        eq(parentGuardiansTable.churchId, churchId),
        eq(childrenTable.churchId, churchId),
      ),
    );

  if (!relationship) {
    res.status(403).json({ error: "Selected pickup person is not authorized for this child." });
    return;
  }

  const [activeRecord] = await db
    .select()
    .from(checkinRecordsTable)
    .where(and(eq(checkinRecordsTable.childId, childId), eq(checkinRecordsTable.status, "active"), isNull(checkinRecordsTable.checkoutTime)))
    .orderBy(desc(checkinRecordsTable.checkinTime));

  if (!activeRecord) {
    res.status(409).json({ error: "Child is not currently checked in." });
    return;
  }

  await db
    .update(checkinRecordsTable)
    .set({
      checkedOutByUserId: req.localUserId,
      pickedUpByGuardianId: guardianId,
      checkoutTime: new Date(),
      status: "checked_out",
    })
    .where(eq(checkinRecordsTable.id, activeRecord.id));

  const [updatedChild] = await db
    .update(childrenTable)
    .set({ checkinStatus: "checked_out" })
    .where(eq(childrenTable.id, childId))
    .returning();

  res.json({ child: await serializeChild(updatedChild) });
});

router.delete("/admin/checkin/children/:childId/active-check-in", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)));

  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  const [activeRecord] = await db
    .select()
    .from(checkinRecordsTable)
    .where(and(eq(checkinRecordsTable.childId, childId), eq(checkinRecordsTable.status, "active"), isNull(checkinRecordsTable.checkoutTime)))
    .orderBy(desc(checkinRecordsTable.checkinTime));

  if (!activeRecord) {
    res.status(409).json({ error: "Child is not currently checked in." });
    return;
  }

  await db.delete(checkinRecordsTable).where(eq(checkinRecordsTable.id, activeRecord.id));

  const [updatedChild] = await db
    .update(childrenTable)
    .set({ checkinStatus: "checked_out" })
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)))
    .returning();

  res.json({ child: await serializeChild(updatedChild) });
});

async function createGuardianRelationship(params: {
  churchId: number;
  childId: number;
  memberId?: unknown;
  name: unknown;
  email: unknown;
  phoneNumber: unknown;
  relationship: unknown;
  authorizedPickup: unknown;
}) {
  const memberId = Number(params.memberId);
  const member = Number.isInteger(memberId) && memberId > 0
    ? (await db
        .select({
          id: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
          phoneNumber: usersTable.phoneNumber,
        })
        .from(usersTable)
        .where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, params.churchId), eq(usersTable.role, "member"))))[0]
    : null;

  const name = member ? `${member.firstName} ${member.lastName}` : requiredText(params.name);
  if (!name) throw new Error("Guardian name is required.");

  const relationship = isRelationship(params.relationship) ? params.relationship : "parent";
  const [guardian] = await db
    .insert(parentGuardiansTable)
    .values({
      churchId: params.churchId,
      memberId: member?.id ?? null,
      name,
      email: textOrNull(params.email) ?? member?.email ?? null,
      phoneNumber: textOrNull(params.phoneNumber) ?? member?.phoneNumber ?? null,
    })
    .returning();

  await db.insert(childGuardianRelationshipsTable).values({
    childId: params.childId,
    guardianId: guardian.id,
    relationship,
    authorizedPickup: params.authorizedPickup !== false,
  });

  return guardian;
}

function normalizeGuardianInputs(body: unknown): Array<{
  memberId?: unknown;
  name: unknown;
  email: unknown;
  phoneNumber: unknown;
  relationship: unknown;
  authorizedPickup: unknown;
}> {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  if (Array.isArray(record.guardians)) {
    return record.guardians
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const guardian = item as Record<string, unknown>;
        return {
          memberId: guardian.memberId,
          name: guardian.name,
          email: guardian.email,
          phoneNumber: guardian.phoneNumber,
          relationship: guardian.relationship,
          authorizedPickup: guardian.authorizedPickup,
        };
      });
  }

  const guardianName = requiredText(record.guardianName);
  return guardianName
    ? [{
        name: guardianName,
        email: record.guardianEmail,
        phoneNumber: record.guardianPhoneNumber,
        relationship: record.guardianRelationship,
        authorizedPickup: record.authorizedPickup,
      }]
    : [];
}

export default router;
