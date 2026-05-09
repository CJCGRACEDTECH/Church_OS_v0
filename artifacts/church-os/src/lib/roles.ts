export const ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  member: "Member",
};
