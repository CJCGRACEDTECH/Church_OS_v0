import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  adminInvitationsTable,
  db,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "../lib/password";
import {
  ADMIN_LEVELS,
  ADMIN_PERMISSION_PRESETS,
  ADMIN_PERMISSIONS,
  DEFAULT_ADMIN_LEVEL_PERMISSIONS,
  PERMISSION_CATALOG,
  ensureAdminPermissionRows,
  getStoredAdminPermissions,
  isAdminLevel,
  normalizePermissions,
  replaceAdminPermissions,
  type AdminLevel,
} from "../lib/admin-permissions";
import { requireAdminPermission, requireAuth, requireRole, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function adminTitle(adminLevel: AdminLevel): string {
  if (adminLevel === ADMIN_LEVELS.SUPER_ADMIN) return "Super Admin";
  if (adminLevel === ADMIN_LEVELS.PASTOR) return "Pastor";
  return "Minister";
}

function getPublicBaseUrl(req: Request): string {
  return process.env.APP_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
}

async function sendAdminInviteEmail(params: {
  to: string;
  name: string;
  inviteUrl: string;
  invitedBy: string;
}) {
  const from = process.env.INVITE_EMAIL_FROM ?? "Church OS <no-reply@churchos.local>";
  const subject = "You're invited to administer Church OS";
  const text = [
    `Hi ${params.name},`,
    "",
    `${params.invitedBy} invited you to join Church OS as an administrator.`,
    `Open this secure invite link to finish setup: ${params.inviteUrl}`,
    "",
    "This link expires automatically and can only be used once.",
  ].join("\n");

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error("Invite email provider rejected the message.");
    }
    return;
  }

  reqLogger(params.to, params.inviteUrl);
}

function reqLogger(email: string, inviteUrl: string) {
  // Replit-safe fallback: local/dev projects can copy this link from server logs
  // until a transactional email provider is configured.
  console.info({ email, inviteUrl }, "Admin invite email fallback");
}

async function getRequesterChurchId(userId: number): Promise<number | null> {
  const [user] = await db.select({ churchId: usersTable.churchId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

function serializeAdminUser(user: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  adminLevel: string | null;
  assignedMinistry: string | null;
  accountStatus: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  createdByUserId: number | null;
}, permissions: string[]) {
  const level = isAdminLevel(user.adminLevel) ? user.adminLevel : ADMIN_LEVELS.PASTOR;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    adminLevel: level,
    adminTitle: adminTitle(level),
    assignedMinistry: user.assignedMinistry,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdByUserId: user.createdByUserId,
    permissions,
  };
}

router.get("/admin/access-check", requireRole("admin"), (_req, res) => {
  res.json({ message: "Admin access granted" });
});

router.get("/admin/permission-catalog", requireRole("admin"), (_req, res) => {
  res.json({
    permissions: PERMISSION_CATALOG,
    defaults: DEFAULT_ADMIN_LEVEL_PERMISSIONS,
    presets: Object.values(ADMIN_PERMISSION_PRESETS),
  });
});

router.get("/admin/users", requireRole("admin"), async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phoneNumber: usersTable.phoneNumber,
      profilePhotoUrl: usersTable.profilePhotoUrl,
      adminLevel: usersTable.adminLevel,
      assignedMinistry: usersTable.assignedMinistry,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
      createdByUserId: usersTable.createdByUserId,
    })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), eq(usersTable.churchId, churchId)))
    .orderBy(desc(usersTable.createdAt));

  const payload = await Promise.all(users.map(async (user) => {
    const permissions = await getStoredAdminPermissions(user.id, isAdminLevel(user.adminLevel) ? user.adminLevel : ADMIN_LEVELS.PASTOR);
    return serializeAdminUser(user, permissions);
  }));

  res.json({ admins: payload });
});

router.get("/admin/users/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid admin id." });
    return;
  }

  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phoneNumber: usersTable.phoneNumber,
      profilePhotoUrl: usersTable.profilePhotoUrl,
      adminLevel: usersTable.adminLevel,
      assignedMinistry: usersTable.assignedMinistry,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
      createdByUserId: usersTable.createdByUserId,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "admin"), eq(usersTable.churchId, churchId)));

  if (!user) {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  const permissions = await getStoredAdminPermissions(user.id, isAdminLevel(user.adminLevel) ? user.adminLevel : ADMIN_LEVELS.PASTOR);
  res.json(serializeAdminUser(user, permissions));
});

router.patch("/admin/users/:id/permissions", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid admin id." });
    return;
  }

  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const permissions = normalizePermissions(req.body?.permissions);
  const [target] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      adminLevel: usersTable.adminLevel,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.churchId, churchId)));

  if (!target || target.role !== "admin") {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  await replaceAdminPermissions({
    userId: target.id,
    permissions,
    grantedByUserId: req.localUserId,
  });

  res.json({ message: "Permissions updated.", permissions });
});

router.post("/admin/invitations", requireSuperAdmin, async (req, res): Promise<void> => {
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const assignedRole = req.body?.adminLevel;
  const assignedMinistry = typeof req.body?.assignedMinistry === "string" ? req.body.assignedMinistry.trim() : "";
  const permissions = normalizePermissions(req.body?.permissions);

  if (!firstName || !lastName || !email.includes("@") || !isAdminLevel(assignedRole)) {
    res.status(400).json({ error: "First name, last name, email, and admin title are required." });
    return;
  }

  const [requester] = await db
    .select({
      id: usersTable.id,
      churchId: usersTable.churchId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.localUserId));

  if (!requester) {
    res.status(401).json({ error: "Requester not found." });
    return;
  }

  const [existingUser] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUser?.role === "admin") {
    res.status(409).json({ error: "That email already belongs to an admin." });
    return;
  }

  const pendingInvitations = await db
    .select({ id: adminInvitationsTable.id })
    .from(adminInvitationsTable)
    .where(and(eq(adminInvitationsTable.email, email), eq(adminInvitationsTable.status, "pending")));

  if (pendingInvitations.length > 0) {
    res.status(409).json({ error: "A pending admin invite already exists for that email." });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + Number(process.env.ADMIN_INVITE_TTL_HOURS ?? 72) * 60 * 60 * 1000);
  const invitePermissions = permissions.length > 0 ? permissions : DEFAULT_ADMIN_LEVEL_PERMISSIONS[assignedRole];

  const [invite] = await db
    .insert(adminInvitationsTable)
    .values({
      churchId: requester.churchId,
      invitedByUserId: requester.id,
      tokenHash: tokenHash(token),
      firstName,
      lastName,
      email,
      assignedRole,
      assignedMinistry: assignedMinistry || null,
      assignedPermissions: invitePermissions,
      status: "pending",
      expiresAt,
    })
    .returning();

  const inviteUrl = `${getPublicBaseUrl(req).replace(/\/$/, "")}/admin/invite/${token}`;
  await sendAdminInviteEmail({
    to: email,
    name: `${firstName} ${lastName}`,
    inviteUrl,
    invitedBy: `${requester.firstName} ${requester.lastName}`,
  });

  res.status(201).json({
    invitation: {
      id: invite.id,
      name: `${invite.firstName} ${invite.lastName}`,
      email: invite.email,
      adminLevel: invite.assignedRole,
      adminTitle: adminTitle(invite.assignedRole),
      assignedMinistry: invite.assignedMinistry,
      permissions: invite.assignedPermissions,
      status: invite.status,
      sentAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    },
  });
});

router.get("/admin/invitations", requireSuperAdmin, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const invitations = await db
    .select()
    .from(adminInvitationsTable)
    .where(eq(adminInvitationsTable.churchId, churchId))
    .orderBy(desc(adminInvitationsTable.createdAt));

  const now = new Date();
  res.json({
    invitations: invitations.map((invite) => {
      const status = invite.status === "pending" && invite.expiresAt <= now ? "expired" : invite.status;
      return {
        id: invite.id,
        name: `${invite.firstName} ${invite.lastName}`,
        email: invite.email,
        adminLevel: invite.assignedRole,
        adminTitle: adminTitle(invite.assignedRole),
        assignedMinistry: invite.assignedMinistry,
        permissions: invite.assignedPermissions,
        status,
        sentAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      };
    }),
  });
});

router.get("/admin/invitations/accept/:token", async (req, res): Promise<void> => {
  const [invite] = await db
    .select()
    .from(adminInvitationsTable)
    .where(eq(adminInvitationsTable.tokenHash, tokenHash(String(req.params.token))));

  if (!invite || invite.status !== "pending" || invite.expiresAt <= new Date()) {
    res.status(404).json({ error: "This invite is invalid or expired." });
    return;
  }

  res.json({
    firstName: invite.firstName,
    lastName: invite.lastName,
    email: invite.email,
    adminLevel: invite.assignedRole,
    adminTitle: adminTitle(invite.assignedRole),
    assignedMinistry: invite.assignedMinistry,
    permissions: invite.assignedPermissions,
    expiresAt: invite.expiresAt.toISOString(),
  });
});

router.post("/admin/invitations/accept/:token", requireAuth, async (req, res): Promise<void> => {
  const [invite] = await db
    .select()
    .from(adminInvitationsTable)
    .where(eq(adminInvitationsTable.tokenHash, tokenHash(String(req.params.token))));

  if (!invite || invite.status !== "pending" || invite.expiresAt <= new Date()) {
    if (invite?.status === "pending") {
      await db.update(adminInvitationsTable).set({ status: "expired" }).where(eq(adminInvitationsTable.id, invite.id));
    }
    res.status(404).json({ error: "This invite is invalid or expired." });
    return;
  }

  const [acceptingUser] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      churchId: usersTable.churchId,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.localUserId));

  if (!acceptingUser) {
    res.status(401).json({ error: "Authenticated user not found." });
    return;
  }

  if (acceptingUser.email !== invite.email) {
    res.status(403).json({ error: "This invite was sent to a different email address. Sign in with the invited email address to accept it." });
    return;
  }

  if (acceptingUser.churchId !== invite.churchId) {
    res.status(403).json({ error: "This invite is not valid for your account." });
    return;
  }

  const userId = acceptingUser.id;

  await db
    .update(usersTable)
    .set({
      role: "admin",
      adminLevel: invite.assignedRole,
      assignedMinistry: invite.assignedMinistry,
      accountStatus: "active",
      createdByUserId: invite.invitedByUserId,
    })
    .where(eq(usersTable.id, userId));

  await ensureAdminPermissionRows({
    userId,
    adminLevel: invite.assignedRole,
    grantedByUserId: invite.invitedByUserId,
    permissions: normalizePermissions(invite.assignedPermissions),
  });

  await db
    .update(adminInvitationsTable)
    .set({
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: new Date(),
    })
    .where(eq(adminInvitationsTable.id, invite.id));

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, userId));

  res.json({ message: "Admin invite accepted.", redirectTo: "/admin" });
});

router.get("/admin/permissions/giving-records", requireAdminPermission(ADMIN_PERMISSIONS.GIVING_DETAILS), (_req, res) => {
  res.json({ message: "Giving records access granted" });
});

router.get("/admin/permissions/giving-summary", requireAdminPermission(ADMIN_PERMISSIONS.GIVING_SUMMARY), (_req, res) => {
  res.json({ message: "Giving summary access granted" });
});

router.get("/admin/permissions/role-management", requireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGEMENT), (_req, res) => {
  res.json({ message: "Admin role management access granted" });
});

export default router;
