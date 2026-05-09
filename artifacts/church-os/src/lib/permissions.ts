import { ROLES, type Role } from "@/lib/roles";

/**
 * Placeholder permission map.
 * Expand this in a future sprint when RBAC needs become clearer.
 */
export const PERMISSIONS = {
  VIEW_MEMBERS: "view_members",
  MANAGE_MEMBERS: "manage_members",
  VIEW_GIVING: "view_giving",
  MANAGE_GIVING: "manage_giving",
  VIEW_REPORTS: "view_reports",
  MANAGE_SETTINGS: "manage_settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_GIVING,
    PERMISSIONS.MANAGE_GIVING,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
  ],
  [ROLES.MEMBER]: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
