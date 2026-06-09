import { Router, type IRouter } from "express";
import { and, eq, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import {
  db,
  usersTable,
  churchesTable,
  oauthAccountsTable,
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
  // Dev-only: allow demo sessions via Bearer token (proxy-safe) or cookie
  if (process.env.NODE_ENV !== "production") {
    const secret = process.env.SESSION_SECRET ?? "dev-demo-secret";
    let demoToken: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const candidate = authHeader.slice(7);
      try {
        const p = jwt.verify(candidate, secret) as { sub?: string };
        if (p.sub && /^\d+$/.test(p.sub)) demoToken = candidate;
      } catch { /* not a demo token */ }
    }
    if (!demoToken) demoToken = req.cookies?.demo_session as string | undefined;

    if (demoToken) {
      try {
        const payload = jwt.verify(demoToken, secret) as { sub: string };
        const userId = parseInt(payload.sub, 10);
        const [demoUser] = await db
          .select({ id: usersTable.id, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus })
          .from(usersTable)
          .where(eq(usersTable.id, userId));
        if (demoUser?.isActive && demoUser.accountStatus === "active") {
          await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, demoUser.id));
          const profile = await findAuthProfileByUserId(demoUser.id);
          if (!profile) { res.status(500).json({ error: "Failed to load profile." }); return; }
          res.json(serializeUser(profile));
          return;
        }
      } catch { /* fall through to Clerk */ }
    }
  }

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
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    if (!primaryEmail) {
      res.status(400).json({ error: "Clerk account has no verified email." });
      return;
    }

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
      res.status(403).json({ error: "No account found for this identity. Contact your church administrator to be added." });
      return;
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

const DEMO_EMAILS: Record<string, string | string[]> = {
  super_admin: "superadmin@churchos.test",
  admin: "admin4@churchos.test",
  children_ministry: "admin5@churchos.test",
  member: "member@churchos.test",
};

router.post("/auth/demo-session", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const role = typeof req.body?.role === "string" ? req.body.role : "";
  const candidates = DEMO_EMAILS[role];
  if (!candidates) {
    res.status(400).json({ error: "role must be 'super_admin', 'admin', 'children_ministry', or 'member'" });
    return;
  }
  const email = Array.isArray(candidates) ? candidates[Math.floor(Math.random() * candidates.length)] : candidates;

  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || user.accountStatus !== "active") {
    res.status(404).json({
      error: "Access profile not found. Contact your administrator.",
    });
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "dev-demo-secret";
  const token = jwt.sign({ sub: String(user.id), role: user.role }, secret, { expiresIn: "24h" });

  res.json({ ok: true, role: user.role, token });
});

router.delete("/auth/demo-session", (req, res) => {
  res.clearCookie("demo_session", { path: "/" });
  res.json({ ok: true });
});

export default router;
