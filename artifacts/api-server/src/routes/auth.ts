import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  churchesTable,
  oauthAccountsTable,
} from "@workspace/db";
import {
  ChangePasswordBody,
  LoginBody,
  SignupBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { hashPassword, verifyPassword } from "../lib/password";
import { getStoredAdminPermissions, isAdminLevel } from "../lib/admin-permissions";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
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

async function getDefaultSignupChurch() {
  const slug = process.env.DEFAULT_SIGNUP_CHURCH_SLUG ?? "cjc-international";
  const [church] = await db
    .select({
      id: churchesTable.id,
      name: churchesTable.name,
    })
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

async function completeSession(req: Request, userId: number) {
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, userId));

  const profile = await findAuthProfileByUserId(userId);
  if (!profile) return null;

  req.session.userId = profile.id;
  req.session.role = profile.role;
  return profile;
}

function randomToken(): string {
  return randomBytes(24).toString("hex");
}

function getAppRedirectUrl(): string {
  return process.env.APP_BASE_URL ?? "/";
}

function requireGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function requireAppleConfig() {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const redirectUri = process.env.APPLE_REDIRECT_URI;

  if (!clientId || !teamId || !keyId || !privateKey || !redirectUri) {
    return null;
  }

  return { clientId, teamId, keyId, privateKey, redirectUri };
}

async function createAppleClientSecret() {
  const config = requireAppleConfig();
  if (!config) return null;

  const signingKey = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setAudience("https://appleid.apple.com")
    .setSubject(config.clientId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);
}

async function upsertOAuthUser(params: {
  provider: "google" | "apple";
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const email = normalizeEmail(params.email);
  const [linkedAccount] = await db
    .select({
      userId: oauthAccountsTable.userId,
    })
    .from(oauthAccountsTable)
    .where(
      and(
        eq(oauthAccountsTable.provider, params.provider),
        eq(oauthAccountsTable.providerUserId, params.providerUserId),
      ),
    );

  if (linkedAccount) {
    return linkedAccount.userId;
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  let userId = existingUser?.id;

  if (!userId) {
    const church = await getDefaultSignupChurch();
    if (!church) {
      throw new Error("Default signup church is not configured.");
    }

    const fallbackName = email.split("@")[0] || "member";
    const [createdUser] = await db
      .insert(usersTable)
      .values({
        churchId: church.id,
        email,
        passwordHash: null,
        firstName: params.firstName?.trim() || fallbackName,
        lastName: params.lastName?.trim() || "Member",
        phoneNumber: null,
        role: "member",
        adminLevel: null,
        assignedMinistry: null,
        accountStatus: "active",
      })
      .returning({ id: usersTable.id });

    userId = createdUser.id;
  }

  await db.insert(oauthAccountsTable).values({
    userId,
    provider: params.provider,
    providerUserId: params.providerUserId,
    providerEmail: email,
  });

  return userId;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select({
      id: usersTable.id,
      passwordHash: usersTable.passwordHash,
      isActive: usersTable.isActive,
      accountStatus: usersTable.accountStatus,
    })
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(email)));

  if (!user || !user.isActive || user.accountStatus !== "active" || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const profile = await completeSession(req, user.id);
  if (!profile) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(serializeUser(profile));
});

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid signup details." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingUser) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const church = await getDefaultSignupChurch();
  if (!church) {
    res.status(503).json({ error: "Self-service signup is not configured yet." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      churchId: church.id,
      email,
      passwordHash,
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      phoneNumber: parsed.data.phoneNumber?.trim() || null,
      role: "member",
      adminLevel: null,
      assignedMinistry: null,
      accountStatus: "active",
    })
    .returning({ id: usersTable.id });

  const profile = await completeSession(req, createdUser.id);
  if (!profile) {
    res.status(500).json({ error: "Account created but session initialization failed." });
    return;
  }

  res.status(201).json(serializeUser(profile));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const profile = await findAuthProfileByUserId(req.session.userId!);
  if (!profile) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
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

  const email = normalizeEmail(parsed.data.email);
  const [conflict] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (conflict && conflict.id !== req.session.userId) {
    res.status(409).json({ error: "That email address is already in use." });
    return;
  }

  const nullable = (value?: string | null) => value?.trim() || null;

  await db
    .update(usersTable)
    .set({
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      preferredName: nullable(parsed.data.preferredName),
      email,
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
    .where(eq(usersTable.id, req.session.userId!));

  const profile = await findAuthProfileByUserId(req.session.userId!);
  if (!profile) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json(serializeUser(profile));
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success || parsed.data.newPassword.length < 8) {
    res.status(400).json({ error: "Use a new password with at least 8 characters." });
    return;
  }

  const [user] = await db
    .select({
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user?.passwordHash) {
    res.status(400).json({ error: "Password login is not enabled for this account." });
    return;
  }

  const matches = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!matches) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  await db
    .update(usersTable)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(usersTable.id, req.session.userId!));

  res.json({ message: "Password updated successfully." });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/auth/oauth/config", (_req, res) => {
  res.json({
    google: Boolean(requireGoogleConfig()),
    apple: Boolean(requireAppleConfig()),
  });
});

router.get("/auth/oauth/google/start", (req, res): void => {
  const config = requireGoogleConfig();
  if (!config) {
    res.status(503).json({ error: "Google sign-in is not configured." });
    return;
  }

  const state = randomToken();
  const nonce = randomToken();
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  req.session.oauthProvider = "google";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("prompt", "select_account");

  res.redirect(authUrl.toString());
});

router.get("/auth/oauth/google/callback", async (req, res): Promise<void> => {
  const config = requireGoogleConfig();
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  if (!config || !code || !state || req.session.oauthState !== state || req.session.oauthProvider !== "google") {
    res.status(400).json({ error: "Invalid Google OAuth callback." });
    return;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    res.status(502).json({ error: "Google token exchange failed." });
    return;
  }

  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) {
    res.status(502).json({ error: "Google did not return an ID token." });
    return;
  }

  const { payload } = await jwtVerify(tokens.id_token, googleJwks, {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: config.clientId,
  });

  if (
    payload.nonce !== req.session.oauthNonce ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    res.status(401).json({ error: "Google identity verification failed." });
    return;
  }

  const userId = await upsertOAuthUser({
    provider: "google",
    providerUserId: payload.sub,
    email: payload.email,
    firstName: typeof payload.given_name === "string" ? payload.given_name : undefined,
    lastName: typeof payload.family_name === "string" ? payload.family_name : undefined,
  });
  await completeSession(req, userId);
  res.redirect(getAppRedirectUrl());
});

router.get("/auth/oauth/apple/start", (req, res): void => {
  const config = requireAppleConfig();
  if (!config) {
    res.status(503).json({ error: "Apple sign-in is not configured." });
    return;
  }

  const state = randomToken();
  const nonce = randomToken();
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;
  req.session.oauthProvider = "apple";

  const authUrl = new URL("https://appleid.apple.com/auth/authorize");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code id_token");
  authUrl.searchParams.set("response_mode", "form_post");
  authUrl.searchParams.set("scope", "name email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);

  res.redirect(authUrl.toString());
});

router.post("/auth/oauth/apple/callback", async (req, res): Promise<void> => {
  const config = requireAppleConfig();
  const clientSecret = await createAppleClientSecret();
  const code = typeof req.body.code === "string" ? req.body.code : null;
  const state = typeof req.body.state === "string" ? req.body.state : null;
  const postedIdToken = typeof req.body.id_token === "string" ? req.body.id_token : null;

  if (
    !config ||
    !clientSecret ||
    !code ||
    !state ||
    !postedIdToken ||
    req.session.oauthState !== state ||
    req.session.oauthProvider !== "apple"
  ) {
    res.status(400).json({ error: "Invalid Apple OAuth callback." });
    return;
  }

  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    res.status(502).json({ error: "Apple token exchange failed." });
    return;
  }

  const { payload } = await jwtVerify(postedIdToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: config.clientId,
  });

  if (
    payload.nonce !== req.session.oauthNonce ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string"
  ) {
    res.status(401).json({ error: "Apple identity verification failed." });
    return;
  }

  let postedUser:
    | {
        name?: { firstName?: string; lastName?: string };
      }
    | undefined;

  if (typeof req.body.user === "string") {
    try {
      postedUser = JSON.parse(req.body.user) as {
        name?: { firstName?: string; lastName?: string };
      };
    } catch {
      postedUser = undefined;
    }
  }

  const userId = await upsertOAuthUser({
    provider: "apple",
    providerUserId: payload.sub,
    email: payload.email,
    firstName: postedUser?.name?.firstName,
    lastName: postedUser?.name?.lastName,
  });
  await completeSession(req, userId);
  res.redirect(getAppRedirectUrl());
});

export default router;
