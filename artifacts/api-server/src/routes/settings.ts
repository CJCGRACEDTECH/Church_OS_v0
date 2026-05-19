import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  adminInvitationsTable,
  churchProfileSettingsTable,
  churchesTable,
  db,
  systemSettingsTable,
  usersTable,
} from "@workspace/db";
import { isAdminLevel } from "../lib/admin-permissions";
import { requireAdminPermission, requireSuperAdmin } from "../middlewares/auth";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";

const router: IRouter = Router();

const SETTING_GROUPS = {
  services: {
    defaultServices: [
      { name: "Tuesday Prayer / Bible Study", day: "Tuesday", time: "20:00", mode: "online" },
      { name: "Thursday Service", day: "Thursday", time: "19:00", mode: "in_person" },
      { name: "Friday Service", day: "Friday", time: "19:00", mode: "in_person" },
      { name: "Saturday Service", day: "Saturday", time: "19:00", mode: "in_person" },
      { name: "Sunday Service", day: "Sunday", time: "11:00", mode: "in_person" },
    ],
    eventCategories: ["Service", "Bible Study", "Prayer", "Baptism", "Fasting Season", "Special Event", "Announcement"],
    calendarDefaultView: "month",
  },
  attendance: {
    qrAttendanceEnabled: true,
    qrExpirationMinutes: 180,
    defaultAttendanceStatus: "present",
    attendanceNotificationsEnabled: false,
    discipleshipAttendanceEnabled: true,
  },
  giving: {
    stripePublishableKeyConfigured: false,
    stripeSecretKeyConfigured: false,
    stripeWebhookSecretConfigured: false,
    givingGoals: {
      tithe: 100000,
      offering: 25000,
      building_fund: 75000,
      missions: 18000,
      special_campaign: 25000,
      other: 5000,
    },
    recurringGivingOptions: ["weekly", "biweekly", "monthly", "yearly"],
    givingCategories: ["Tithe", "Offering", "Building Fund", "Missions", "Special Campaign", "Other"],
    taxReceiptFooter: "No goods or services were provided in exchange for these contributions, other than intangible religious benefits.",
    defaultCurrency: "USD",
  },
  children: {
    pickupVerificationEnabled: true,
    securityCodeEnabled: false,
    defaultClassroomCapacity: 20,
    classrooms: ["Preschool", "K-2", "3-5"],
  },
  notifications: {
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    serviceReminderEnabled: false,
    eventReminderEnabled: true,
    givingReceiptEnabled: true,
    attendanceFollowUpEnabled: true,
    adminInviteEmailEnabled: true,
  },
  integrations: {
    stripeEnabled: false,
    zoomEnabled: false,
    youtubeEnabled: false,
    emailProviderEnabled: false,
    smsProviderEnabled: false,
  },
  security: {
    sessionTimeoutMinutes: 720,
    maxFailedLoginAttempts: 5,
    passwordResetEnabled: true,
    adminActivityLoggingEnabled: true,
    twoFactorPlaceholderEnabled: false,
  },
  system: {
    theme: "light",
    dashboardLayout: "standard",
    defaultHomepage: "/admin",
    dateFormat: "MMM d, yyyy",
    timeFormat: "12h",
  },
};

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function requesterChurchId(userId: number) {
  const [user] = await db.select({ churchId: usersTable.churchId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

async function requesterIsSuperAdmin(userId: number) {
  const [user] = await db.select({ adminLevel: usersTable.adminLevel, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.role === "admin" && user.adminLevel === "super_admin";
}

async function ensureChurchProfile(churchId: number, requesterId: number) {
  const [profile] = await db.select().from(churchProfileSettingsTable).where(eq(churchProfileSettingsTable.churchId, churchId));
  if (profile) return profile;

  const [church] = await db.select().from(churchesTable).where(eq(churchesTable.id, churchId));
  const [created] = await db.insert(churchProfileSettingsTable).values({
    churchId,
    churchName: church?.name ?? "Church",
    updatedByUserId: requesterId,
  }).returning();
  return created;
}

async function ensureSettings(churchId: number, requesterId: number) {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.churchId, churchId));
  const byGroup = new Map(rows.map((row) => [row.settingGroup, objectValue(row.settings)]));

  for (const [group, defaults] of Object.entries(SETTING_GROUPS)) {
    if (byGroup.has(group)) {
      byGroup.set(group, { ...defaults, ...byGroup.get(group) });
      continue;
    }
    const [created] = await db.insert(systemSettingsTable).values({
      churchId,
      settingGroup: group,
      settings: defaults,
      updatedByUserId: requesterId,
    }).returning();
    byGroup.set(created.settingGroup, objectValue(created.settings));
  }

  return Object.fromEntries(Object.keys(SETTING_GROUPS).map((group) => [group, byGroup.get(group) ?? SETTING_GROUPS[group as keyof typeof SETTING_GROUPS]]));
}

function serializeProfile(profile: Awaited<ReturnType<typeof ensureChurchProfile>>) {
  return {
    churchName: profile.churchName,
    churchLogoUrl: profile.churchLogoUrl,
    churchAddress: profile.churchAddress,
    churchPhoneNumber: profile.churchPhoneNumber,
    churchEmail: profile.churchEmail,
    websiteUrl: profile.websiteUrl,
    churchEin: profile.churchEin,
    timezone: profile.timezone,
    defaultLanguage: profile.defaultLanguage,
    youtubeUrl: profile.youtubeUrl,
    facebookUrl: profile.facebookUrl,
    instagramUrl: profile.instagramUrl,
    defaultZoomLink: profile.defaultZoomLink,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.get("/admin/settings", requireAdminPermission(ADMIN_PERMISSIONS.SYSTEM_SETTINGS), async (req, res): Promise<void> => {
  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const profile = await ensureChurchProfile(churchId, req.localUserId);
  const settings = await ensureSettings(churchId, req.localUserId);
  settings.giving = {
    ...objectValue(settings.giving),
    stripePublishableKeyConfigured: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY),
    stripeSecretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };

  res.json({ churchProfile: serializeProfile(profile), settings });
});

router.patch("/admin/settings/church-profile", requireAdminPermission(ADMIN_PERMISSIONS.SYSTEM_SETTINGS), async (req, res): Promise<void> => {
  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }
  const profile = await ensureChurchProfile(churchId, req.localUserId);
  const churchName = cleanText(req.body?.churchName);
  if (!churchName) { res.status(400).json({ error: "Church name is required." }); return; }

  const [updated] = await db.update(churchProfileSettingsTable).set({
    churchName,
    churchLogoUrl: cleanText(req.body?.churchLogoUrl),
    churchAddress: cleanText(req.body?.churchAddress),
    churchPhoneNumber: cleanText(req.body?.churchPhoneNumber),
    churchEmail: cleanText(req.body?.churchEmail),
    websiteUrl: cleanText(req.body?.websiteUrl),
    churchEin: cleanText(req.body?.churchEin),
    timezone: cleanText(req.body?.timezone) ?? "America/New_York",
    defaultLanguage: cleanText(req.body?.defaultLanguage) ?? "English",
    youtubeUrl: cleanText(req.body?.youtubeUrl),
    facebookUrl: cleanText(req.body?.facebookUrl),
    instagramUrl: cleanText(req.body?.instagramUrl),
    defaultZoomLink: cleanText(req.body?.defaultZoomLink),
    updatedByUserId: req.localUserId,
  }).where(eq(churchProfileSettingsTable.id, profile.id)).returning();

  await db.update(churchesTable).set({ name: churchName }).where(eq(churchesTable.id, churchId));
  res.json({ churchProfile: serializeProfile(updated) });
});

router.patch("/admin/settings/groups/:group", requireAdminPermission(ADMIN_PERMISSIONS.SYSTEM_SETTINGS), async (req, res): Promise<void> => {
  const group = req.params.group as keyof typeof SETTING_GROUPS;
  if (!Object.prototype.hasOwnProperty.call(SETTING_GROUPS, group)) {
    res.status(404).json({ error: "Unknown settings group." });
    return;
  }
  if ((group === "giving" || group === "security" || group === "integrations") && !(await requesterIsSuperAdmin(req.localUserId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const currentRows = await db.select().from(systemSettingsTable).where(and(eq(systemSettingsTable.churchId, churchId), eq(systemSettingsTable.settingGroup, group)));
  const current = objectValue(currentRows[0]?.settings ?? SETTING_GROUPS[group]);
  const next = { ...current, ...objectValue(req.body?.settings) };
  delete next.stripeSecretKey;
  delete next.stripeWebhookSecret;

  const [saved] = currentRows[0]
    ? await db.update(systemSettingsTable).set({ settings: next, updatedByUserId: req.localUserId }).where(eq(systemSettingsTable.id, currentRows[0].id)).returning()
    : await db.insert(systemSettingsTable).values({ churchId, settingGroup: group, settings: next, updatedByUserId: req.localUserId }).returning();

  res.json({ group, settings: objectValue(saved.settings) });
});

router.patch("/admin/users/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid admin id." }); return; }
  const adminLevel = req.body?.adminLevel;
  const accountStatus = req.body?.accountStatus;
  if (adminLevel !== undefined && !isAdminLevel(adminLevel)) { res.status(400).json({ error: "Invalid admin title." }); return; }
  if (accountStatus !== undefined && !["active", "pending", "disabled"].includes(accountStatus)) { res.status(400).json({ error: "Invalid account status." }); return; }

  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const [updated] = await db.update(usersTable).set({
    firstName: cleanText(req.body?.firstName) ?? undefined,
    lastName: cleanText(req.body?.lastName) ?? undefined,
    phoneNumber: cleanText(req.body?.phoneNumber),
    profilePhotoUrl: cleanText(req.body?.profilePhotoUrl),
    adminLevel,
    assignedMinistry: cleanText(req.body?.assignedMinistry),
    accountStatus,
    role: "admin",
  }).where(and(eq(usersTable.id, id), eq(usersTable.role, "admin"), eq(usersTable.churchId, churchId))).returning();

  if (!updated) { res.status(404).json({ error: "Admin not found." }); return; }
  res.json({ admin: updated });
});

router.delete("/admin/users/:id/admin-access", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id === req.localUserId) { res.status(400).json({ error: "Invalid admin id." }); return; }

  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const [updated] = await db.update(usersTable).set({
    role: "member",
    adminLevel: null,
    assignedMinistry: null,
    accountStatus: "active",
  }).where(and(eq(usersTable.id, id), eq(usersTable.role, "admin"), eq(usersTable.churchId, churchId))).returning();
  if (!updated) { res.status(404).json({ error: "Admin not found." }); return; }
  res.json({ message: "Admin access removed." });
});

router.get("/admin/activity-log", requireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGEMENT), async (req, res) => {
  const churchId = await requesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const recentAdmins = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    lastLoginAt: usersTable.lastLoginAt,
    accountStatus: usersTable.accountStatus,
  }).from(usersTable).where(and(eq(usersTable.role, "admin"), eq(usersTable.churchId, churchId)));

  const recentInvites = await db.select().from(adminInvitationsTable).where(eq(adminInvitationsTable.churchId, churchId));
  res.json({
    log: [
      ...recentAdmins.map((admin) => ({
        type: "admin_login",
        label: `${admin.firstName} ${admin.lastName}`,
        detail: admin.lastLoginAt ? `Last login ${admin.lastLoginAt.toISOString()}` : "No login recorded",
        status: admin.accountStatus,
      })),
      ...recentInvites.map((invite) => ({
        type: "admin_invite",
        label: `${invite.firstName} ${invite.lastName}`,
        detail: `Invite ${invite.status} for ${invite.email}`,
        status: invite.status,
      })),
    ].slice(0, 20),
  });
});

export default router;
