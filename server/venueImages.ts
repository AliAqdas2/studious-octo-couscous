import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENUE_IMAGES_DIR = path.resolve(__dirname, "..", "venueimages");

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
