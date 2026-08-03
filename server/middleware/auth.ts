import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import {
  getUserFromAccessToken,
  type AuthUser,
} from "../services/auth/authService.js";

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError("Authentication required", 401);
    }
    const user = await getUserFromAccessToken(token);
    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (token) {
      const user = await getUserFromAccessToken(token);
      req.user = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      };
    }
    next();
  } catch {
    next();
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError("Authentication required", 401));
    return;
  }
  if (req.user.role !== "admin") {
    next(new AppError("Admin access required", 403));
    return;
  }
  next();
}
