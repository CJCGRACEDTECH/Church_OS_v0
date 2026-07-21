import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  churchesTable,
  oauthAccountsTable,
  adminPermissionsTable,
} from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { getAuth, createClerkClient } from "@clerk/express";
import { getStoredAdminPermissions, isAdminLevel } from "../lib/admin-permissions";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const ADMIN_TITLE_LABELS = {
  super_admin: "Super Admin",
  pastor: "Pastor",
  minister: "Minister",
} as const;

type AuthProfile = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  preferredLanguage: string | null;
  emergencyContactName: string | null;
  emergencyContactPhoneNumber: string | null;
  streetAddress: string | null;
  apartmentUnit: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  role: "admin" | "member";
  adminLevel: "super_admin" | "pastor" | "minister" | null;
  assignedMinistry: string | null;
  accountStatus: "active" | "pending" | "disabled";
  createdByUserId: number | null;
  churchId: number;
  churchName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  authProviders: string[];
  hasPassword: boolean;
  adminPermissions: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function serializeUser(user: AuthProfile) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    phoneNumber: user.phoneNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    maritalStatus: user.maritalStatus,
    occupation: user.occupation,
    preferredLanguage: user.preferredLanguage,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhoneNumber: user.emergencyContactPhoneNumber,
    streetAddress: user.streetAddress,
    apartmentUnit: user.apartmentUnit,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    country: user.country,
    role: user.role,
    adminLevel: user.adminLevel,
    adminTitle: user.adminLevel ? ADMIN_TITLE_LABELS[user.adminLevel] : null,
    assignedMinistry: user.assignedMinistry,
    accountStatus: user.accountStatus,
    createdByUserId: user.createdByUserId,
    churchId: user.churchId,
    churchName: user.churchName,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    authProviders: user.authProviders,
    hasPassword: user.hasPassword,
    adminPermissions: user.adminPermissions,
  };
}

async function getDefaultChurch() {
  const slug = process.env.DEFAULT_SIGNUP_CHURCH_SLUG ?? "cjc-international";
  const [church] = await db
    .select({ id: churchesTable.id, name: churchesTable.name })
    .from(churchesTable)
    .where(eq(churchesTable.slug, slug));
  return church ?? null;
}

async function findAuthProfileByUserId(userId: number): Promise<AuthProfile | null> {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      preferredName: usersTable.preferredName,
      phoneNumber: usersTable.phoneNumber,
      profilePhotoUrl: usersTable.profilePhotoUrl,
      dateOfBirth: usersTable.dateOfBirth,
      gender: usersTable.gender,
      maritalStatus: usersTable.maritalStatus,
      occupation: usersTable.occupation,
      preferredLanguage: usersTable.preferredLanguage,
      emergencyContactName: usersTable.emergencyContactName,
      emergencyContactPhoneNumber: usersTable.emergencyContactPhoneNumber,
      streetAddress: usersTable.streetAddress,
      apartmentUnit: usersTable.apartmentUnit,
      city: usersTable.city,
      state: usersTable.state,
      zipCode: usersTable.zipCode,
      country: usersTable.country,
      role: usersTable.role,
      adminLevel: usersTable.adminLevel,
      assignedMinistry: usersTable.assignedMinistry,
      accountStatus: usersTable.accountStatus,
      createdByUserId: usersTable.createdByUserId,
      churchId: usersTable.churchId,
      churchName: churchesTable.name,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable)
    .innerJoin(churchesTable, eq(usersTable.churchId, churchesTable.id))
    .where(eq(usersTable.id, userId));

  if (!user) return null;

  const providerRows = await db
    .select({ provider: oauthAccountsTable.provider })
    .from(oauthAccountsTable)
    .where(eq(oauthAccountsTable.userId, user.id));

  const authProviders = [
    ...(user.passwordHash ? ["email"] : []),
    ...providerRows.map((row) => row.provider),
    "clerk",
  ];

  const adminPermissions = user.role === "admin"
    ? await getStoredAdminPermissions(user.id, isAdminLevel(user.adminLevel) ? user.adminLevel : "pastor")
    : [];

  return {
    ...user,
    authProviders,
    hasPassword: Boolean(user.passwordHash),
    adminPermissions,
  };
}

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!process.env.CLERK_SECRET_KEY) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const clerkUserId = auth.userId;

  let [localUser] = await db
    .select({ id: usersTable.id, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));

  if (!localUser) {
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmailObj = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );

    if (!primaryEmailObj?.emailAddress) {
      res.status(400).json({ error: "Clerk account has no primary email." });
      return;
    }

    if (primaryEmailObj.verification?.status !== "verified") {
      res.status(403).json({ error: "Email address must be verified before signing in. Please verify your email and try again." });
      return;
    }

    const primaryEmail = primaryEmailObj.emailAddress;

    const email = normalizeEmail(primaryEmail);

    const [byEmail] = await db
      .select({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (byEmail) {
      await db
        .update(usersTable)
        .set({
          clerkUserId,
          ...(byEmail.role === "member" && byEmail.accountStatus === "pending" ? { accountStatus: "active" as const } : {}),
        })
        .where(eq(usersTable.id, byEmail.id));
      localUser = {
        id: byEmail.id,
        isActive: byEmail.isActive,
        accountStatus: byEmail.role === "member" && byEmail.accountStatus === "pending" ? "active" : byEmail.accountStatus,
      };
    } else {
      // Bootstrap: if no church exists yet (fresh production deploy), the first
      // sign-in automatically becomes the super admin and creates the church.
      const [existingChurch] = await db.select({ id: churchesTable.id }).from(churchesTable).limit(1);

      if (existingChurch) {
        res.status(403).json({ error: "No account found for this identity. Contact your church administrator to be added." });
        return;
      }

      const SUPER_ADMIN_PERMISSIONS = [
        "attendance_checkin", "attendance_management", "member_directory",
        "member_profiles", "event_management", "followup_notes", "pastoral_notes",
        "giving_summary", "giving_details", "giving_view_own", "giving_management",
        "giving_reports", "campaign_management", "reports", "admin_management",
        "system_settings",
      ];

      const firstName = clerkUser.firstName ?? email.split("@")[0];
      const lastName = clerkUser.lastName ?? "Admin";

      const [newChurch] = await db
        .insert(churchesTable)
        .values({ name: "CJC Church", slug: "cjc-international" })
        .returning({ id: churchesTable.id });

      const [newUser] = await db
        .insert(usersTable)
        .values({
          churchId: newChurch.id,
          email,
          firstName,
          lastName,
          role: "admin",
          adminLevel: "super_admin",
          accountStatus: "active",
          isActive: true,
          clerkUserId,
          memberStatus: "active_member",
          profileStatus: "approved_member",
        })
        .returning({ id: usersTable.id, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus });

      await db.insert(adminPermissionsTable).values(
        SUPER_ADMIN_PERMISSIONS.map((permission) => ({ userId: newUser.id, permission })),
      );

      localUser = { id: newUser.id, isActive: newUser.isActive, accountStatus: newUser.accountStatus };
    }
  }

  if (!localUser.isActive || localUser.accountStatus !== "active") {
    res.status(403).json({ error: "Your account is inactive. Contact your administrator." });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, localUser.id));

  const profile = await findAuthProfileByUserId(localUser.id);
  if (!profile) {
    res.status(500).json({ error: "Failed to load profile." });
    return;
  }

  res.json(serializeUser(profile));
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid profile details." });
    return;
  }

  const nullable = (value?: string | null) => value?.trim() || null;

  await db
    .update(usersTable)
    .set({
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      preferredName: nullable(parsed.data.preferredName),
      phoneNumber: nullable(parsed.data.phoneNumber),
      profilePhotoUrl: nullable(parsed.data.profilePhotoUrl),
      dateOfBirth: parsed.data.dateOfBirth || null,
      gender: nullable(parsed.data.gender),
      maritalStatus: nullable(parsed.data.maritalStatus),
      occupation: nullable(parsed.data.occupation),
      preferredLanguage: nullable(parsed.data.preferredLanguage),
      emergencyContactName: nullable(parsed.data.emergencyContactName),
      emergencyContactPhoneNumber: nullable(parsed.data.emergencyContactPhoneNumber),
      streetAddress: nullable(parsed.data.streetAddress),
      apartmentUnit: nullable(parsed.data.apartmentUnit),
      city: nullable(parsed.data.city),
      state: nullable(parsed.data.state),
      zipCode: nullable(parsed.data.zipCode),
      country: nullable(parsed.data.country),
    })
    .where(eq(usersTable.id, req.localUserId));

  const profile = await findAuthProfileByUserId(req.localUserId);
  if (!profile) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json(serializeUser(profile));
});

export default router;
