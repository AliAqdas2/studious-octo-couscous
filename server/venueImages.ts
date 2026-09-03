import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express, type NextFunction, type Response } from "express";
import { AppError } from "./lib/errors.js";
import type { AuthenticatedRequest } from "./middleware/auth.js";
import { getUserFromAccessToken } from "./services/auth/authService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENUE_IMAGES_DIR = path.resolve(__dirname, "..", "venueimages");

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

async function requireAuthForVenueImages(
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

export function registerVenueImages(app: Express): void {
  if (!fs.existsSync(VENUE_IMAGES_DIR)) {
    console.warn(`[venueimages] Directory not found: ${VENUE_IMAGES_DIR}`);
  }

  app.use(
    "/venueimages",
    requireAuthForVenueImages,
    express.static(VENUE_IMAGES_DIR, {
      index: false,
      fallthrough: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".jpeg") || filePath.endsWith(".jpg")) {
          res.setHeader("Content-Type", "image/jpeg");
        } else if (filePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        } else if (filePath.endsWith(".webp")) {
          res.setHeader("Content-Type", "image/webp");
        }
        res.setHeader("Cache-Control", "private, max-age=86400");
      },
    })
  );
}
