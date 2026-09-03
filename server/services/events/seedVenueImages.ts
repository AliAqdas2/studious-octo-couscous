import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { venueImages, venues } from "../../db/schema/index.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export interface VenueImageSeedRow {
  seedKey: string;
  venueName: string;
  filename: string;
  caption: string | null;
  sortOrder: number;
}

/** Bundled photos in mangia-crm/venueimages — matched to house venue names. */
export const VENUE_IMAGE_SEED: VenueImageSeedRow[] = [
  {
    seedKey: "1015_15th_st",
    venueName: "1015 15th Street NW",
    filename: "101515thSt.jpeg",
    caption: null,
    sortOrder: 10,
  },
  {
    seedKey: "city_tavern_1st_floor",
    venueName: "City Tavern",
    filename: "CityTavern-1stFloor.jpeg",
    caption: "1st Floor",
    sortOrder: 10,
  },
  {
    seedKey: "city_tavern_2nd_floor",
    venueName: "City Tavern",
    filename: "CityTavern-2ndFloor.jpeg",
    caption: "2nd Floor",
    sortOrder: 20,
  },
  {
    seedKey: "mr_smiths",
    venueName: "Mr. Smith's of Georgetown",
    filename: "Mr.Smiths.jpeg",
    caption: null,
    sortOrder: 10,
  },
  {
    seedKey: "navy_yard_8th_floor",
    venueName: "99 M St SE - Navy Yard",
    filename: "NavyYard-8thFloor.jpeg",
    caption: "8th Floor",
    sortOrder: 10,
  },
  {
    seedKey: "navy_yard_penthouse",
    venueName: "99 M St SE - Navy Yard",
    filename: "NavyYard-Penthouse.jpeg",
    caption: "Penthouse",
    sortOrder: 20,
  },
  {
    seedKey: "the_foundry",
    venueName: "The Foundry",
    filename: "TheFoundry.jpeg",
    caption: null,
    sortOrder: 10,
  },
  {
    seedKey: "the_wharf_2nd_floor",
    venueName: "The Wharf Penthouse",
    filename: "TheWharf-2ndFloor.jpeg",
    caption: "2nd Floor",
    sortOrder: 10,
  },
  {
    seedKey: "the_wharf_penthouse",
    venueName: "The Wharf Penthouse",
    filename: "TheWharf-Penthouse.jpeg",
    caption: "Penthouse",
    sortOrder: 20,
  },
  {
    seedKey: "whittemore_ballroom",
    venueName: "The Whittemore House",
    filename: "WhittemoreHouse-Ballroom.jpeg",
    caption: "Ballroom",
    sortOrder: 10,
  },
  {
    seedKey: "whittemore_upstairs",
    venueName: "The Whittemore House",
    filename: "WhittemoreHouse-Upstairs.jpeg",
    caption: "Upstairs",
    sortOrder: 20,
  },
  {
    seedKey: "wingos",
    venueName: "Wingos!",
    filename: "Wingos.jpeg",
    caption: null,
    sortOrder: 10,
  },
];

export interface SeedVenueImagesResult {
  upserted: number;
  skippedMissingVenue: number;
}

/**
 * Link bundled venue photos to existing house venues by name.
 * Idempotent by seed_key — never deletes rows.
 */
export async function seedVenueImages(): Promise<SeedVenueImagesResult> {
  const db = requireDb();
  let upserted = 0;
  let skippedMissingVenue = 0;

  const venueRows = await db.select().from(venues);
  const venueByName = new Map(venueRows.map((v) => [v.name, v.id]));

  for (const row of VENUE_IMAGE_SEED) {
    const venueId = venueByName.get(row.venueName);
    if (!venueId) {
      console.warn(
        `[seedVenueImages] Skipping ${row.seedKey}: venue not found "${row.venueName}"`
      );
      skippedMissingVenue += 1;
      continue;
    }

    const imageUrl = `/venueimages/${row.filename}`;

    const [existing] = await db
      .select()
      .from(venueImages)
      .where(eq(venueImages.seedKey, row.seedKey))
      .limit(1);

    if (existing) {
      await db
        .update(venueImages)
        .set({
          venueId,
          imageUrl,
          caption: row.caption,
          sortOrder: row.sortOrder,
          isActive: true,
          updatedDate: new Date(),
        })
        .where(eq(venueImages.id, existing.id));
    } else {
      await db.insert(venueImages).values({
        venueId,
        imageUrl,
        caption: row.caption,
        sortOrder: row.sortOrder,
        seedKey: row.seedKey,
        isActive: true,
      });
    }
    upserted += 1;
  }

  return { upserted, skippedMissingVenue };
}
