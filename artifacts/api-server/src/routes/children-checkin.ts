import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Router, type IRouter } from "express";
import {
  childDocumentsTable,
  childGuardianRelationshipsTable,
  childIncidentsTable,
  checkinRecordsTable,
  childrenClassroomsTable,
  childrenTable,
  db,
  parentGuardiansTable,
  usersTable,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();
// Check-in helpers (e.g. teen volunteers) can check children in and out.
// Leaders can also register and edit children and see history.
const requireCheckInAccess = requireAdminPermission(ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN);
const requireLeaderAccess = requireAdminPermission(ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE);

function booleanFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "on";
}

type Classroom = typeof childrenClassroomsTable.$inferSelect;

type ChildFlags = {
  openIncidents: Map<number, number>;
  documentCategories: Map<number, Set<string>>;
  classrooms: Classroom[];
};

async function loadChildFlags(churchId: number, childIds?: number[]): Promise<ChildFlags> {
  const incidentFilters = [eq(childIncidentsTable.churchId, churchId), eq(childIncidentsTable.status, "open")];
  const documentFilters = [eq(childDocumentsTable.churchId, churchId)];
  if (childIds) {
    if (childIds.length === 0) return { openIncidents: new Map(), documentCategories: new Map(), classrooms: [] };
    incidentFilters.push(inArray(childIncidentsTable.childId, childIds));
    documentFilters.push(inArray(childDocumentsTable.childId, childIds));
  }

  const incidentRows = await db
    .select({ childId: childIncidentsTable.childId, total: count() })
    .from(childIncidentsTable)
    .where(and(...incidentFilters))
    .groupBy(childIncidentsTable.childId);

  const documentRows = await db
    .selectDistinct({ childId: childDocumentsTable.childId, category: childDocumentsTable.category })
    .from(childDocumentsTable)
    .where(and(...documentFilters));

  const documentCategories = new Map<number, Set<string>>();
  for (const row of documentRows) {
    const categories = documentCategories.get(row.childId) ?? new Set<string>();
    categories.add(row.category);
    documentCategories.set(row.childId, categories);
  }

  return {
    openIncidents: new Map(incidentRows.map((row) => [row.childId, Number(row.total)])),
    documentCategories,
    classrooms: await loadClassrooms(churchId),
  };
}

/** Classrooms youngest first (rooms without a minimum age last). */
function loadClassrooms(churchId: number): Promise<Classroom[]> {
  return db
    .select()
    .from(childrenClassroomsTable)
    .where(eq(childrenClassroomsTable.churchId, churchId))
    .orderBy(asc(childrenClassroomsTable.minAgeYears), asc(childrenClassroomsTable.name));
}

/**
 * The classroom a child should move to, or null when their room still fits.
 * - Special-needs children belong in the special needs room at any age.
 * - Anyone a leader placed in the special needs room stays there.
 * - Children who outgrew their room's age range (or whose room no longer
 *   exists) move to the room for their age. Children placed in an older room
 *   early are left alone.
 */
function suggestedClassroom(child: typeof childrenTable.$inferSelect, classrooms: Classroom[]): string | null {
  if (classrooms.length === 0) return null;
  const current = classrooms.find((classroom) => classroom.name === child.classroom) ?? null;

  if (child.hasSpecialNeeds) {
    const specialNeedsRoom = classrooms.find((classroom) => classroom.isSpecialNeeds);
    return specialNeedsRoom && current?.id !== specialNeedsRoom.id ? specialNeedsRoom.name : null;
  }
  if (current?.isSpecialNeeds) return null;

  const age = calculateAge(child.dateOfBirth);
  if (age === null) return null;
  if (current && (current.maxAgeYears === null || age <= current.maxAgeYears)) return null;

  const target = classrooms.find((classroom) =>
    !classroom.isSpecialNeeds
    && (classroom.minAgeYears === null || age >= classroom.minAgeYears)
    && (classroom.maxAgeYears === null || age <= classroom.maxAgeYears),
  );
  return target && target.name !== child.classroom ? target.name : null;
}

/** Forms the ministry expects on file for this child that are not uploaded yet. */
function missingDocuments(child: typeof childrenTable.$inferSelect, categories: Set<string> | undefined): string[] {
  const missing: string[] = [];
  if (child.allergyInformation && !categories?.has("medication_consent")) missing.push("medication_consent");
  return missing;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const ALLOWED_URL_SCHEMES = /^https?:\/\//i;

function safeUrlOrNull(value: unknown): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  return ALLOWED_URL_SCHEMES.test(text) ? text : null;
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

async function serializeChild(child: typeof childrenTable.$inferSelect, flags?: ChildFlags) {
  const childFlags = flags ?? await loadChildFlags(child.churchId, [child.id]);
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
    isVisitor: child.isVisitor,
    hasSpecialNeeds: child.hasSpecialNeeds,
    registeredAt: child.createdAt.toISOString(),
    openIncidentCount: childFlags.openIncidents.get(child.id) ?? 0,
    missingDocuments: missingDocuments(child, childFlags.documentCategories.get(child.id)),
    suggestedClassroom: suggestedClassroom(child, childFlags.classrooms),
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

  const flags = await loadChildFlags(churchId);
  res.json({ children: await Promise.all(children.map((child) => serializeChild(child, flags))) });
});

router.get("/admin/checkin/history", requireLeaderAccess, async (req, res): Promise<void> => {
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

router.get("/admin/checkin/member-contacts", requireLeaderAccess, async (req, res): Promise<void> => {
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

router.post("/admin/checkin/children", requireLeaderAccess, async (req, res): Promise<void> => {
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
      profilePhotoUrl: safeUrlOrNull(req.body?.profilePhotoUrl),
      allergyInformation: textOrNull(req.body?.allergyInformation),
      medicalNotes: textOrNull(req.body?.medicalNotes),
      specialInstructions: textOrNull(req.body?.specialInstructions),
      classroom: textOrNull(req.body?.classroom),
      isVisitor: booleanFlag(req.body?.isVisitor),
      hasSpecialNeeds: booleanFlag(req.body?.hasSpecialNeeds),
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

router.patch("/admin/checkin/children/:childId", requireLeaderAccess, async (req, res): Promise<void> => {
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
      profilePhotoUrl: safeUrlOrNull(req.body?.profilePhotoUrl),
      allergyInformation: textOrNull(req.body?.allergyInformation),
      medicalNotes: textOrNull(req.body?.medicalNotes),
      specialInstructions: textOrNull(req.body?.specialInstructions),
      classroom: textOrNull(req.body?.classroom),
      isVisitor: booleanFlag(req.body?.isVisitor),
      hasSpecialNeeds: booleanFlag(req.body?.hasSpecialNeeds),
    })
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)))
    .returning();

  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  res.json({ child: await serializeChild(child) });
});

router.post("/admin/checkin/children/:childId/guardians", requireLeaderAccess, async (req, res): Promise<void> => {
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
  const generatedCode = pickupCode();
  await db.insert(checkinRecordsTable).values({
    childId,
    checkedInByUserId: req.localUserId,
    classroom,
    pickupCode: generatedCode,
    status: "active",
  });

  const [updatedChild] = await db
    .update(childrenTable)
    .set({ checkinStatus: "checked_in", classroom })
    .where(eq(childrenTable.id, childId))
    .returning();

  res.json({ child: await serializeChild(updatedChild), pickupCode: generatedCode });
});

router.post("/admin/checkin/children/:childId/check-out", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const guardianId = Number(req.body?.guardianId);
  const submittedCode = typeof req.body?.pickupCode === "string" ? req.body.pickupCode.trim().toUpperCase() : "";
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !Number.isInteger(guardianId) || !churchId) {
    res.status(400).json({ error: "Child and pickup person are required." });
    return;
  }

  if (!submittedCode) {
    res.status(400).json({ error: "Pickup security code is required." });
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

  if (!activeRecord.pickupCode || activeRecord.pickupCode.toUpperCase() !== submittedCode) {
    res.status(403).json({ error: "Incorrect pickup security code." });
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

router.delete("/admin/checkin/children/:childId/active-check-in", requireLeaderAccess, async (req, res): Promise<void> => {
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

// Moves children into the classroom suggested for them (e.g. on promotion Sunday).
router.post("/admin/children/move-up", requireLeaderAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const requestedIds: unknown[] = Array.isArray(req.body?.childIds) ? req.body.childIds : [];
  const childIds = requestedIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (childIds.length === 0) {
    res.status(400).json({ error: "Choose at least one child to move." });
    return;
  }

  const children = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.churchId, churchId), inArray(childrenTable.id, childIds)));
  const classrooms = await loadClassrooms(churchId);
  const moved: Array<{ childId: number; from: string | null; to: string }> = [];
  for (const child of children) {
    const target = suggestedClassroom(child, classrooms);
    if (!target) continue;
    await db.update(childrenTable).set({ classroom: target }).where(eq(childrenTable.id, child.id));
    moved.push({ childId: child.id, from: child.classroom, to: target });
  }

  res.json({ moved });
});

// Data for the printed child name tag and parent pickup stub.
router.get("/admin/checkin/children/:childId/label", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const [record] = await db
    .select({
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      allergyInformation: childrenTable.allergyInformation,
      medicalNotes: childrenTable.medicalNotes,
      hasSpecialNeeds: childrenTable.hasSpecialNeeds,
      classroom: checkinRecordsTable.classroom,
      pickupCode: checkinRecordsTable.pickupCode,
      checkinTime: checkinRecordsTable.checkinTime,
    })
    .from(checkinRecordsTable)
    .innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id))
    .where(
      and(
        eq(checkinRecordsTable.childId, childId),
        eq(childrenTable.churchId, churchId),
        eq(checkinRecordsTable.status, "active"),
        isNull(checkinRecordsTable.checkoutTime),
      ),
    )
    .orderBy(desc(checkinRecordsTable.checkinTime));

  if (!record) {
    res.status(409).json({ error: "Child is not currently checked in." });
    return;
  }

  res.json({
    label: {
      childName: `${record.firstName} ${record.lastName}`,
      classroom: record.classroom,
      allergyInformation: record.allergyInformation,
      medicalNotes: record.medicalNotes,
      hasSpecialNeeds: record.hasSpecialNeeds,
      pickupCode: record.pickupCode,
      checkinTime: record.checkinTime.toISOString(),
    },
  });
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
