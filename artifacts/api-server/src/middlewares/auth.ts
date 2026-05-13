import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  getStoredAdminPermissions,
  isActiveSuperAdmin,
  isAdminLevel,
  type AdminPermission,
} from "../lib/admin-permissions";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
    oauthState?: string;
    oauthNonce?: string;
    oauthProvider?: "google" | "apple";
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (req.session.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  void isActiveSuperAdmin(req.session.userId).then((allowed) => {
    if (!allowed) {
      res.status(403).json({ error: "Super Admin access required" });
      return;
    }
    next();
  }).catch(next);
}

export function requireAdminPermission(permission: AdminPermission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session?.userId) {
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
      .where(eq(usersTable.id, req.session.userId));

    if (!user || user.role !== "admin" || !user.isActive || user.accountStatus !== "active") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const adminLevel = isAdminLevel(user.adminLevel) ? user.adminLevel : "pastor";
    const permissions = await getStoredAdminPermissions(req.session.userId, adminLevel);

    if (!permissions.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
