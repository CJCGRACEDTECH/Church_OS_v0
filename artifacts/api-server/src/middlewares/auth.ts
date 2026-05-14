import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import {
  getStoredAdminPermissions,
  isActiveSuperAdmin,
  isAdminLevel,
  type AdminPermission,
} from "../lib/admin-permissions";

declare global {
  namespace Express {
    interface Request {
      localUserId: number;
      localUserRole: "admin" | "member";
    }
  }
}

async function resolveDemoUser(req: Request): Promise<{ id: number; role: "admin" | "member" } | null> {
  if (process.env.NODE_ENV === "production") return null;
  const token = req.cookies?.demo_session as string | undefined;
  if (!token) return null;
  try {
    const secret = process.env.SESSION_SECRET ?? "dev-demo-secret";
    const payload = jwt.verify(token, secret) as { sub: string; role: string };
    const userId = parseInt(payload.sub, 10);
    if (isNaN(userId)) return null;
    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive, accountStatus: usersTable.accountStatus })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user || !user.isActive || user.accountStatus !== "active") return null;
    return { id: user.id, role: user.role as "admin" | "member" };
  } catch {
    return null;
  }
}

async function resolveLocalUser(req: Request): Promise<{ id: number; role: "admin" | "member" } | null> {
  const demoUser = await resolveDemoUser(req);
  if (demoUser) return demoUser;

  const auth = getAuth(req);
  if (!auth?.userId) return null;

  const [user] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      isActive: usersTable.isActive,
      accountStatus: usersTable.accountStatus,
    })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, auth.userId));

  if (!user || !user.isActive || user.accountStatus !== "active") return null;
  return { id: user.id, role: user.role };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const localUser = await resolveLocalUser(req);
  if (!localUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.localUserId = localUser.id;
  req.localUserRole = localUser.role;
  next();
}

export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const localUser = await resolveLocalUser(req);
    if (!localUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (localUser.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.localUserId = localUser.id;
    req.localUserRole = localUser.role;
    next();
  };
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const localUser = await resolveLocalUser(req);
  if (!localUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const allowed = await isActiveSuperAdmin(localUser.id);
  if (!allowed) {
    res.status(403).json({ error: "Super Admin access required" });
    return;
  }
  req.localUserId = localUser.id;
  req.localUserRole = localUser.role;
  next();
}

export function requireAdminPermission(permission: AdminPermission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const localUser = await resolveLocalUser(req);
    if (!localUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const [user] = await db
      .select({
        role: usersTable.role,
        adminLevel: usersTable.adminLevel,
        accountStatus: usersTable.accountStatus,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.id, localUser.id));

    if (!user || user.role !== "admin" || !user.isActive || user.accountStatus !== "active") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const adminLevel = isAdminLevel(user.adminLevel) ? user.adminLevel : "pastor";
    const permissions = await getStoredAdminPermissions(localUser.id, adminLevel);

    if (!permissions.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.localUserId = localUser.id;
    req.localUserRole = localUser.role;
    next();
  };
}
