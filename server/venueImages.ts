import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "url";
import express, { type Express } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENUE_IMAGES_DIR = path.resolve(__dirname, "..", "venueimages");

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

function sanitizeVenueImageName(name: string): string {
  const base = path.basename(name || "floor-map").replace(/[^\w.\-]+/g, "_");
  const trimmed = base.slice(0, 100) || "floor-map";
  const ext = path.extname(trimmed).toLowerCase();
  const stem = path.basename(trimmed, ext) || "floor-map";
  const safeExt = ALLOWED_EXT.has(ext) ? ext : ".jpeg";
  return `${stem}${safeExt}`;
}

/**
 * Persist a floor-map upload under venueimages/ for BEO preview + Word/PDF embed.
 * Returns a durable public path like `/venueimages/CityTavern-1stFloor.jpeg`.
 */
export function saveVenueFloorMapBuffer(params: {
  buffer: Buffer;
  filename: string;
}): { fileUrl: string; absolutePath: string; storedName: string } {
  if (!fs.existsSync(VENUE_IMAGES_DIR)) {
    fs.mkdirSync(VENUE_IMAGES_DIR, { recursive: true });
  }
  const safe = sanitizeVenueImageName(params.filename);
  const stem = path.basename(safe, path.extname(safe));
  const ext = path.extname(safe);
  let storedName = safe;
  let absolutePath = path.join(VENUE_IMAGES_DIR, storedName);
  if (fs.existsSync(absolutePath)) {
    storedName = `${stem}-${randomUUID().slice(0, 8)}${ext}`;
    absolutePath = path.join(VENUE_IMAGES_DIR, storedName);
  }
  fs.writeFileSync(absolutePath, params.buffer);
  return {
    fileUrl: `/venueimages/${storedName}`,
    absolutePath,
    storedName,
  };
}

/** Public static floorplan / venue photos (no auth). Metadata CRUD stays on /api. */
export function registerVenueImages(app: Express): void {
  if (!fs.existsSync(VENUE_IMAGES_DIR)) {
    console.warn(`[venueimages] Directory not found: ${VENUE_IMAGES_DIR}`);
  }

  app.use(
    "/venueimages",
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
        res.setHeader("Cache-Control", "public, max-age=86400");
      },
    })
  );
}
