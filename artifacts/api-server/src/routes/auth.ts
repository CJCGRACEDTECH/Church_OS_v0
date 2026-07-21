import { Router, type IRouter } from "express";
import { and, eq, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  churchesTable,
  oauthAccountsTable,
  adminPermissionsTable,
  adminInvitationsTable,
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
      const activateNow = byEmail.accountStatus === "pending";
      await db
        .update(usersTable)
        .set({
          clerkUserId,
          ...(activateNow ? { accountStatus: "active" as const } : {}),
        })
        .where(eq(usersTable.id, byEmail.id));
      localUser = {
        id: byEmail.id,
        isActive: byEmail.isActive,
        accountStatus: activateNow ? "active" : byEmail.accountStatus,
      };
    } else {
      // Check for a pending admin invite so the invited user can sign in
      // before they explicitly accept the invite token.
      const [pendingInvite] = await db
        .select({
          id: adminInvitationsTable.id,
          firstName: adminInvitationsTable.firstName,
          lastName: adminInvitationsTable.lastName,
          churchId: adminInvitationsTable.churchId,
        })
        .from(adminInvitationsTable)
        .where(
          and(
            eq(adminInvitationsTable.email, email),
            eq(adminInvitationsTable.status, "pending"),
            gte(adminInvitationsTable.expiresAt, new Date()),
          ),
        );

      if (pendingInvite) {
        const [newUser] = await db
          .insert(usersTable)
          .values({
            email,
            firstName: pendingInvite.firstName,
            lastName: pendingInvite.lastName,
            churchId: pendingInvite.churchId,
            role: "member",
            accountStatus: "active",
            isActive: true,
            clerkUserId,
          })
          .returning({ id: usersTable.id, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus });
        localUser = newUser;
      } else {
        res.status(403).json({ error: "No account found for this identity. Contact your church administrator to be added." });
        return;
      }
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
