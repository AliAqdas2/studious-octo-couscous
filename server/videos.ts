import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express, type NextFunction, type Response } from "express";
import { AppError } from "./lib/errors.js";
import type { AuthenticatedRequest } from "./middleware/auth.js";
import { getUserFromAccessToken } from "./services/auth/authService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VIDEOS_DIR = path.resolve(__dirname, "..", "videos");

function extractAccessToken(req: AuthenticatedRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token.length > 0) return token;
  }
  const query = req.query.access_token;
  if (typeof query === "string" && query.trim().length > 0) {
    return query.trim();
  }
  return null;
}

async function requireAuthForVideos(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractAccessToken(req);
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

export function registerTrainingVideos(app: Express): void {
  if (!fs.existsSync(VIDEOS_DIR)) {
    console.warn(`[videos] Directory not found: ${VIDEOS_DIR}`);
  }

  app.use(
    "/videos",
    requireAuthForVideos,
    express.static(VIDEOS_DIR, {
      index: false,
      fallthrough: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Accept-Ranges", "bytes");
        }
      },
    })
  );
}
