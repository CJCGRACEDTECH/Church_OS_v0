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
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  const proto = (req.get("x-forwarded-proto") ?? req.protocol) || "https";
  return `${proto}://${req.get("host")}`;
}

function buildInviteEmailHtml(params: { name: string; inviteUrl: string; invitedBy: string; baseUrl: string }): string {
  const logoUrl = `${params.baseUrl.replace(/\/$/, "")}/logo.svg`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Invitation — CJC Church</title></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1f2e 0%,#0f1520 100%);border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
          <img src="${logoUrl}" alt="CJC Church" width="72" height="72" style="display:block;margin:0 auto 18px;border-radius:50%;background:rgba(255,255,255,0.08);padding:8px;" />
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Christ Jesus Centered Church</p>
          <p style="margin:8px 0 0;font-size:12px;color:#7c8fa8;letter-spacing:2.5px;text-transform:uppercase;">One Kingdom. All Nations.</p>
        </td></tr>

        <!-- Blue accent bar -->
        <tr><td style="background:linear-gradient(90deg,#1d4ed8,#3b82f6,#1d4ed8);height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#2563eb;letter-spacing:2px;text-transform:uppercase;">Admin Invitation</p>
          <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.25;">You're invited to lead<br>with Church OS</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.75;">
            Hi <strong style="color:#0f172a;">${params.name}</strong>,
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">
            <strong style="color:#0f172a;">${params.invitedBy}</strong> has invited you to join the Church OS admin team for <strong style="color:#0f172a;">CJC Church</strong>. Click the button below to accept — you'll sign in (or create an account) using this email address and be set up as an admin right away.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="padding-bottom:8px;">
              <a href="${params.inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:8px;letter-spacing:-0.2px;">Accept Admin Invitation &rarr;</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Copy link -->
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">Or copy and paste this link into your browser:</p>
          <p style="margin:0;font-size:12px;color:#2563eb;word-break:break-all;line-height:1.6;">${params.inviteUrl}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#1a1f2e;border-radius:0 0 12px 12px;padding:24px 40px;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
            This secure invite link expires in <strong style="color:#cbd5e1;">72 hours</strong> and can only be used once. If you weren't expecting this invitation, you can safely ignore this email.
          </p>
          <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.5;">
            CJC Church &nbsp;&middot;&nbsp; 7403 Boston Blvd, Springfield, VA 22153 &nbsp;&middot;&nbsp; <a href="https://cjcchurch.com" style="color:#4b5563;text-decoration:none;">cjcchurch.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendAdminInviteEmail(params: {
  to: string;
  name: string;
  inviteUrl: string;
  invitedBy: string;
  baseUrl: string;
}) {
  const from = process.env.INVITE_EMAIL_FROM ?? "CJC Church <no-reply@cjcchurch.com>";
  const subject = "You're invited to administer Church OS";
  const text = [
    `Hi ${params.name},`,
    "",
    `${params.invitedBy} invited you to join Church OS as an administrator.`,
    `Open this secure invite link to finish setup: ${params.inviteUrl}`,
    "",
    "This link expires in 72 hours and can only be used once.",
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
        html: buildInviteEmailHtml(params),
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

router.get("/admin/permission-catalog", requireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGEMENT), (_req, res) => {
  res.json({
    permissions: PERMISSION_CATALOG,
    defaults: DEFAULT_ADMIN_LEVEL_PERMISSIONS,
    presets: Object.values(ADMIN_PERMISSION_PRESETS),
  });
});

router.get("/admin/users", requireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGEMENT), async (req, res): Promise<void> => {
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

router.get("/admin/users/:id", requireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGEMENT), async (req, res): Promise<void> => {
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
    baseUrl: getPublicBaseUrl(req),
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

router.delete("/admin/invitations/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid invitation id." }); return; }

  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const [invite] = await db
    .select({ id: adminInvitationsTable.id, status: adminInvitationsTable.status })
    .from(adminInvitationsTable)
    .where(and(eq(adminInvitationsTable.id, id), eq(adminInvitationsTable.churchId, churchId)));

  if (!invite) { res.status(404).json({ error: "Invitation not found." }); return; }
  if (invite.status !== "pending") { res.status(409).json({ error: "Only pending invitations can be revoked." }); return; }

  await db
    .update(adminInvitationsTable)
    .set({ status: "expired" })
    .where(eq(adminInvitationsTable.id, id));

  res.json({ message: "Invitation revoked." });
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
