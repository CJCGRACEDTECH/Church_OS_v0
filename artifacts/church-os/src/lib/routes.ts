export const AUTH_ROUTES = {
  LOGIN: "/",
  UNAUTHORIZED: "/unauthorized",
} as const;

export const ADMIN_ROUTES = {
  DASHBOARD: "/admin",
  PROFILE: "/admin/profile",
  MEMBERS: "/admin/members",
  HOUSEHOLD_INBOX: "/admin/household-inbox",
  HOUSEHOLDS: "/admin/households",
  SERVICES: "/admin/services",
  ATTENDANCE: "/admin/attendance",
  CHECK_IN: "/admin/check-in",
  GIVING: "/admin/giving",
  EVANGELISM: "/admin/evangelism",
  REPORTS: "/admin/reports",
  SETTINGS: "/admin/settings",
  ADMIN_MANAGEMENT: "/admin/admins",
} as const;

export const MEMBER_ROUTES = {
  DASHBOARD: "/member",
  PROFILE: "/member/profile",
  HOUSEHOLD: "/member/household",
  GIVE: "/member/give",
  SERVICES: "/member/services",
} as const;
