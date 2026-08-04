import { Router, type CookieOptions, type Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  getMe,
  login,
  logout,
  refresh,
  REFRESH_COOKIE_NAME,
} from "../services/auth/authService.js";
import {
  isPasswordResetAvailable,
  requestPasswordReset,
  resetPasswordWithCode,
  verifyPasswordResetCode,
} from "../services/auth/passwordReset.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const resetRequestSchema = z.object({
  email: z.string().email(),
});

const resetVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

const resetConfirmSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
  newPassword: z.string().min(8),
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  name: "auth",
});

const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  name: "password-reset",
});

/** No-op when ENABLE_AUTH_RATE_LIMIT is not set. */
const maybeAuthRateLimit = env.enableAuthRateLimit()
  ? authRateLimit
  : ((_req, _res, next) => {
      next();
    }) as typeof authRateLimit;

const maybePasswordResetRateLimit = env.enableAuthRateLimit()
  ? passwordResetRateLimit
  : ((_req, _res, next) => {
      next();
    }) as typeof passwordResetRateLimit;

/** In-memory cache for password-reset availability (60s). */
let availabilityCache: { available: boolean; expiresAt: number } | null = null;

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/api/auth",
  });
}

const router = Router();

router.post("/login", maybeAuthRateLimit, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login({
      email: body.email,
      password: body.password,
      userAgent: req.get("user-agent") ?? undefined,
      ip: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    const result = await refresh({
      refreshToken,
      userAgent: req.get("user-agent") ?? undefined,
      ip: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await logout(refreshToken);
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.get("/password-reset/status", async (_req, res, next) => {
  try {
    const now = Date.now();
    if (availabilityCache && availabilityCache.expiresAt > now) {
      res.json({ available: availabilityCache.available });
      return;
    }
    const available = await isPasswordResetAvailable();
    availabilityCache = { available, expiresAt: now + 60_000 };
    res.json({ available });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/password-reset/request",
  maybePasswordResetRateLimit,
  async (req, res, next) => {
    try {
      const body = resetRequestSchema.parse(req.body);
      const result = await requestPasswordReset({
        email: body.email,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/password-reset/verify",
  maybePasswordResetRateLimit,
  async (req, res, next) => {
    try {
      const body = resetVerifySchema.parse(req.body);
      const result = await verifyPasswordResetCode({
        email: body.email,
        code: body.code,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/password-reset/confirm",
  maybePasswordResetRateLimit,
  async (req, res, next) => {
    try {
      const body = resetConfirmSchema.parse(req.body);
      const result = await resetPasswordWithCode({
        email: body.email,
        code: body.code,
        newPassword: body.newPassword,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
