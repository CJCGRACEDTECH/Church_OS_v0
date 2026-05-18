import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  childGuardianRelationshipsTable,
  childrenTable,
  db,
  parentGuardiansTable,
  usersTable,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();

const requireDirectoryAccess = requireAdminPermission(ADMIN_PERMISSIONS.MEMBER_DIRECTORY);
const requireProfileAccess = requireAdminPermission(ADMIN_PERMISSIONS.MEMBER_PROFILES);

const MEMBER_STATUSES = new Set(["visitor", "member", "active_member", "inactive"]);
const BAPTISM_STATUSES = new Set(["baptized", "not_baptized", "unknown"]);
const SERVING_STATUSES = new Set(["serving", "not_serving", "interested"]);
const CONTACT_METHODS = new Set(["phone", "email", "text"]);

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function getRequesterChurchId(userId: number) {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return user?.churchId ?? null;
}

function serializeMember(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    profilePhotoUrl: user.profilePhotoUrl,
    email: user.email,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    memberStatus: user.memberStatus,
    ministryDepartment: user.ministryDepartment,
    joinDate: user.joinDate,
    baptismStatus: user.baptismStatus,
    smallGroup: user.smallGroup,
    servingStatus: user.servingStatus,
    streetAddress: user.streetAddress,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    preferredContactMethod: user.preferredContactMethod,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhoneNumber: user.emergencyContactPhoneNumber,
    emergencyContactRelationship: user.emergencyContactRelationship,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function memberPayload(body: unknown) {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  return {
    firstName: requiredText(record.firstName),
    lastName: requiredText(record.lastName),
    preferredName: textOrNull(record.preferredName),
    profilePhotoUrl: textOrNull(record.profilePhotoUrl),
    email: requiredText(record.email).toLowerCase(),
    phoneNumber: textOrNull(record.phoneNumber),
    dateOfBirth: dateOrNull(record.dateOfBirth),
    gender: textOrNull(record.gender),
    memberStatus: enumValue(record.memberStatus, MEMBER_STATUSES, "member"),
    ministryDepartment: textOrNull(record.ministryDepartment),
    joinDate: dateOrNull(record.joinDate),
    baptismStatus: enumValue(record.baptismStatus, BAPTISM_STATUSES, "unknown"),
    smallGroup: textOrNull(record.smallGroup),
    servingStatus: enumValue(record.servingStatus, SERVING_STATUSES, "not_serving"),
    streetAddress: textOrNull(record.streetAddress),
    city: textOrNull(record.city),
    state: textOrNull(record.state),
    zipCode: textOrNull(record.zipCode),
    preferredContactMethod: enumValue(record.preferredContactMethod, CONTACT_METHODS, "email"),
    emergencyContactName: textOrNull(record.emergencyContactName),
    emergencyContactPhoneNumber: textOrNull(record.emergencyContactPhoneNumber),
    emergencyContactRelationship: textOrNull(record.emergencyContactRelationship),
  };
}

router.get("/admin/members", requireDirectoryAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const memberStatus = typeof req.query.memberStatus === "string" ? req.query.memberStatus : "";
  const ministryDepartment = typeof req.query.ministryDepartment === "string" ? req.query.ministryDepartment : "";
  const servingStatus = typeof req.query.servingStatus === "string" ? req.query.servingStatus : "";
  const baptismStatus = typeof req.query.baptismStatus === "string" ? req.query.baptismStatus : "";

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
    ...(MEMBER_STATUSES.has(memberStatus) ? [eq(usersTable.memberStatus, memberStatus as typeof usersTable.$inferSelect.memberStatus)] : []),
    ...(ministryDepartment ? [eq(usersTable.ministryDepartment, ministryDepartment)] : []),
    ...(SERVING_STATUSES.has(servingStatus) ? [eq(usersTable.servingStatus, servingStatus as typeof usersTable.$inferSelect.servingStatus)] : []),
    ...(BAPTISM_STATUSES.has(baptismStatus) ? [eq(usersTable.baptismStatus, baptismStatus as typeof usersTable.$inferSelect.baptismStatus)] : []),
  ];

  const members = await db
    .select()
    .from(usersTable)
    .where(and(...filters))
    .orderBy(usersTable.lastName, usersTable.firstName);

  const departments = Array.from(new Set(members.map((member) => member.ministryDepartment).filter(Boolean))).sort();

  res.json({
    members: members.map(serializeMember),
    filters: { ministryDepartments: departments },
  });
});

router.get("/admin/members/:id", requireProfileAccess, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(memberId) || !churchId) {
    res.status(400).json({ error: "Invalid member." });
    return;
  }

  const [member] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, churchId), eq(usersTable.role, "member")));

  if (!member) {
    res.status(404).json({ error: "Member not found." });
    return;
  }

  const childMatches = await db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      classroom: childrenTable.classroom,
      checkinStatus: childrenTable.checkinStatus,
      relationship: childGuardianRelationshipsTable.relationship,
      authorizedPickup: childGuardianRelationshipsTable.authorizedPickup,
    })
    .from(childGuardianRelationshipsTable)
    .innerJoin(childrenTable, eq(childGuardianRelationshipsTable.childId, childrenTable.id))
    .innerJoin(parentGuardiansTable, eq(childGuardianRelationshipsTable.guardianId, parentGuardiansTable.id))
    .where(and(
      eq(childrenTable.churchId, churchId),
      or(
        eq(parentGuardiansTable.email, member.email),
        member.phoneNumber ? eq(parentGuardiansTable.phoneNumber, member.phoneNumber) : undefined,
      ),
    ))
    .orderBy(childrenTable.lastName, childrenTable.firstName);

  res.json({
    member: serializeMember(member),
    children: childMatches.map((child) => ({
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      classroom: child.classroom,
      checkinStatus: child.checkinStatus,
      relationship: child.relationship,
      authorizedPickup: child.authorizedPickup,
    })),
  });
});

router.post("/admin/members", requireProfileAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const payload = memberPayload(req.body);
  if (!payload.firstName || !payload.lastName || !payload.email) {
    res.status(400).json({ error: "First name, last name, and email are required." });
    return;
  }

  try {
    const [member] = await db
      .insert(usersTable)
      .values({
        churchId,
        ...payload,
        role: "member",
        accountStatus: "active",
        isActive: true,
      })
      .returning();

    res.status(201).json({ member: serializeMember(member) });
  } catch {
    res.status(409).json({ error: "A user with this email already exists." });
  }
});

router.patch("/admin/members/:id", requireProfileAccess, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(memberId) || !churchId) {
    res.status(400).json({ error: "Invalid member." });
    return;
  }

  const payload = memberPayload(req.body);
  if (!payload.firstName || !payload.lastName || !payload.email) {
    res.status(400).json({ error: "First name, last name, and email are required." });
    return;
  }

  try {
    const [member] = await db
      .update(usersTable)
      .set(payload)
      .where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, churchId), eq(usersTable.role, "member")))
      .returning();

    if (!member) {
      res.status(404).json({ error: "Member not found." });
      return;
    }

    res.json({ member: serializeMember(member) });
  } catch {
    res.status(409).json({ error: "A user with this email already exists." });
  }
});

export default router;
