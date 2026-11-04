import { eq } from "drizzle-orm";
import { adminPermissionsTable, db, usersTable } from "@workspace/db";

export const ADMIN_LEVELS = {
  MINISTER: "minister",
  PASTOR: "pastor",
  SUPER_ADMIN: "super_admin",
} as const;

export type AdminLevel = (typeof ADMIN_LEVELS)[keyof typeof ADMIN_LEVELS];

export const ADMIN_PERMISSIONS = {
  ATTENDANCE_CHECKIN: "attendance_checkin",
  CHILDREN_MINISTRY_MANAGE: "children_ministry_manage",
  ATTENDANCE_MANAGEMENT: "attendance_management",
  MEMBER_DIRECTORY: "member_directory",
  MEMBER_PROFILES: "member_profiles",
  EVENT_MANAGEMENT: "event_management",
  FOLLOWUP_NOTES: "followup_notes",
  PASTORAL_NOTES: "pastoral_notes",
  GIVING_SUMMARY: "giving_summary",
  GIVING_DETAILS: "giving_details",
  GIVING_VIEW_OWN: "giving_view_own",
  GIVING_MANAGEMENT: "giving_management",
  GIVING_REPORTS: "giving_reports",
  CAMPAIGN_MANAGEMENT: "campaign_management",
  REPORTS: "reports",
  ADMIN_MANAGEMENT: "admin_management",
  SYSTEM_SETTINGS: "system_settings",
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export const PERMISSION_CATALOG: Array<{
  key: AdminPermission;
  label: string;
  description: string;
}> = [
  {
    key: ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN,
    label: "Children Check-In",
    description: "Check children in and out, print labels, and report incidents.",
  },
  {
    key: ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE,
    label: "Children Ministry Leader",
    description: "Register and edit children, view history, manage incidents, documents, permission slips, and classrooms.",
  },
  {
    key: ADMIN_PERMISSIONS.ATTENDANCE_MANAGEMENT,
    label: "Attendance Management",
    description: "Create service and discipleship attendance sessions and edit attendance records.",
  },
  {
    key: ADMIN_PERMISSIONS.MEMBER_DIRECTORY,
    label: "Member Directory",
    description: "View the church member directory.",
  },
  {
    key: ADMIN_PERMISSIONS.MEMBER_PROFILES,
    label: "Member Profiles",
    description: "Open member profiles and care context.",
  },
  {
    key: ADMIN_PERMISSIONS.EVENT_MANAGEMENT,
    label: "Event Management",
    description: "View and manage services, events, and attendance contexts.",
  },
  {
    key: ADMIN_PERMISSIONS.GIVING_MANAGEMENT,
    label: "Giving Management",
    description: "View and manage giving records, tax status, and recurring giving.",
  },
  {
    key: ADMIN_PERMISSIONS.CAMPAIGN_MANAGEMENT,
    label: "Campaign Management",
    description: "Create and manage giving campaigns.",
  },
  {
    key: ADMIN_PERMISSIONS.ADMIN_MANAGEMENT,
    label: "Admin Management",
    description: "Invite admins and edit admin permissions.",
  },
  {
    key: ADMIN_PERMISSIONS.SYSTEM_SETTINGS,
    label: "System Settings",
    description: "Manage church-wide system configuration.",
  },
];

export const VALID_ADMIN_PERMISSIONS = PERMISSION_CATALOG.map((permission) => permission.key);

export const DEFAULT_ADMIN_LEVEL_PERMISSIONS: Record<AdminLevel, AdminPermission[]> = {
  [ADMIN_LEVELS.MINISTER]: [
    ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN,
    ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE,
    ADMIN_PERMISSIONS.ATTENDANCE_MANAGEMENT,
    ADMIN_PERMISSIONS.MEMBER_DIRECTORY,
    ADMIN_PERMISSIONS.MEMBER_PROFILES,
    ADMIN_PERMISSIONS.EVENT_MANAGEMENT,
  ],
  [ADMIN_LEVELS.PASTOR]: [
    ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN,
    ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE,
    ADMIN_PERMISSIONS.ATTENDANCE_MANAGEMENT,
    ADMIN_PERMISSIONS.MEMBER_DIRECTORY,
    ADMIN_PERMISSIONS.MEMBER_PROFILES,
    ADMIN_PERMISSIONS.EVENT_MANAGEMENT,
  ],
  [ADMIN_LEVELS.SUPER_ADMIN]: VALID_ADMIN_PERMISSIONS,
};

export const ADMIN_PERMISSION_PRESETS = {
  CHILDREN_CHECKIN_HELPER: {
    key: "children_checkin_helper",
    label: "Children Check-In Helper",
    description: "Check-in and check-out only, for volunteers such as teen helpers.",
    permissions: [ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN],
  },
  CHILDREN_MINISTRY_LEADER: {
    key: "children_ministry_leader",
    label: "Children Ministry Leader",
    description: "Full Children Ministry access: records, history, incidents, documents, and classrooms.",
    permissions: [ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN, ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE],
  },
} as const;

const CHILDREN_MINISTRY_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN,
  ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE,
]);

/** True when every permission the admin holds is a Children Ministry permission. */
export function isChildrenMinistryOnly(permissions: readonly AdminPermission[]): boolean {
  return permissions.length > 0 && permissions.every((permission) => CHILDREN_MINISTRY_PERMISSIONS.has(permission));
}

export function isAdminLevel(value: unknown): value is AdminLevel {
  return value === ADMIN_LEVELS.MINISTER || value === ADMIN_LEVELS.PASTOR || value === ADMIN_LEVELS.SUPER_ADMIN;
}

export function normalizePermissions(values: unknown): AdminPermission[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(VALID_ADMIN_PERMISSIONS);
  return Array.from(new Set(values.filter((value): value is AdminPermission => typeof value === "string" && allowed.has(value as AdminPermission))));
}

export function getDefaultPermissions(adminLevel: AdminLevel | null | undefined): AdminPermission[] {
  if (!adminLevel || !isAdminLevel(adminLevel)) return DEFAULT_ADMIN_LEVEL_PERMISSIONS.pastor;
  return DEFAULT_ADMIN_LEVEL_PERMISSIONS[adminLevel];
}

export async function getStoredAdminPermissions(userId: number, adminLevel: AdminLevel | null | undefined): Promise<AdminPermission[]> {
  const rows = await db
    .select({ permission: adminPermissionsTable.permission })
    .from(adminPermissionsTable)
    .where(eq(adminPermissionsTable.userId, userId));

  if (rows.length === 0) {
    return getDefaultPermissions(adminLevel);
  }

  return normalizePermissions(rows.map((row) => row.permission));
}

export async function replaceAdminPermissions(params: {
  userId: number;
  permissions: AdminPermission[];
  grantedByUserId: number;
}) {
  await db.delete(adminPermissionsTable).where(eq(adminPermissionsTable.userId, params.userId));

  if (params.permissions.length > 0) {
    await db.insert(adminPermissionsTable).values(
      params.permissions.map((permission) => ({
        userId: params.userId,
        permission,
        grantedByUserId: params.grantedByUserId,
      })),
    );
  }
}

export async function ensureAdminPermissionRows(params: {
  userId: number;
  adminLevel: AdminLevel;
  grantedByUserId?: number | null;
  permissions?: AdminPermission[];
}) {
  const existing = await db
    .select({ id: adminPermissionsTable.id })
    .from(adminPermissionsTable)
    .where(eq(adminPermissionsTable.userId, params.userId));

  if (existing.length > 0) return;

  await replaceAdminPermissions({
    userId: params.userId,
    permissions: params.permissions ?? getDefaultPermissions(params.adminLevel),
    grantedByUserId: params.grantedByUserId ?? params.userId,
  });
}

export async function isActiveSuperAdmin(userId: number): Promise<boolean> {
  const [user] = await db
    .select({
      role: usersTable.role,
      adminLevel: usersTable.adminLevel,
      accountStatus: usersTable.accountStatus,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return Boolean(user?.role === "admin" && user.adminLevel === "super_admin" && user.accountStatus === "active" && user.isActive);
}
