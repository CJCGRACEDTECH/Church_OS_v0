import { ROLES, type Role } from "@/lib/roles";

export type AdminLevel = "super_admin" | "pastor" | "minister";

export const ADMIN_LEVELS = {
  SUPER_ADMIN: "super_admin",
  PASTOR: "pastor",
  MINISTER: "minister",
} as const satisfies Record<string, AdminLevel>;

export const PERMISSIONS = {
  ATTENDANCE_CHECKIN: "attendance_checkin",
  MEMBER_DIRECTORY: "member_directory",
  MEMBER_PROFILES: "member_profiles",
  EVENT_MANAGEMENT: "event_management",
  FOLLOWUP_NOTES: "followup_notes",
  PASTORAL_NOTES: "pastoral_notes",
  GIVING_SUMMARY: "giving_summary",
  GIVING_DETAILS: "giving_details",
  REPORTS: "reports",
  ADMIN_MANAGEMENT: "admin_management",
  SYSTEM_SETTINGS: "system_settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.ATTENDANCE_CHECKIN]: "Attendance Check-In",
  [PERMISSIONS.MEMBER_DIRECTORY]: "Member Directory",
  [PERMISSIONS.MEMBER_PROFILES]: "Member Profiles",
  [PERMISSIONS.EVENT_MANAGEMENT]: "Event Management",
  [PERMISSIONS.FOLLOWUP_NOTES]: "Follow-Up Notes",
  [PERMISSIONS.PASTORAL_NOTES]: "Pastoral Notes",
  [PERMISSIONS.GIVING_SUMMARY]: "Giving Summary",
  [PERMISSIONS.GIVING_DETAILS]: "Giving Details",
  [PERMISSIONS.REPORTS]: "Reports",
  [PERMISSIONS.ADMIN_MANAGEMENT]: "Admin Management",
  [PERMISSIONS.SYSTEM_SETTINGS]: "System Settings",
};

export function hasPermission(
  role: Role,
  permission: Permission,
  adminPermissions?: string[] | null,
): boolean {
  if (role === ROLES.ADMIN) {
    return adminPermissions?.includes(permission) ?? false;
  }

  return false;
}
