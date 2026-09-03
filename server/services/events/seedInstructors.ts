import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { instructors } from "../../db/schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MARKDOWN_PATH = join(
  __dirname,
  "../../../data/instructors-and-bios.md"
);

export interface InstructorSeedRow {
  name: string;
  bio: string;
  seedKey: string;
  sortOrder: number;
}

export function slugSeedKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeBio(bio: string): string {
  return bio.trim().replace(/\\!/g, "!").replace(/\\-/g, "-");
}

/** Parse `# **Name**` sections from the bundled markdown file. */
export function parseInstructorsMarkdown(content: string): InstructorSeedRow[] {
  const lines = content.split(/\r?\n/);
  const results: InstructorSeedRow[] = [];
  let currentName: string | null = null;
  let bioLines: string[] = [];

  const flush = () => {
    if (!currentName) return;
    const bio = normalizeBio(bioLines.join("\n"));
    results.push({
      name: currentName,
      bio,
      seedKey: slugSeedKey(currentName),
      sortOrder: results.length + 1,
    });
    bioLines = [];
  };

  for (const line of lines) {
    const match = line.match(/^#\s+\*\*(.+)\*\*\s*$/);
    if (match) {
      flush();
      currentName = match[1].trim();
      continue;
    }
    if (currentName !== null) {
      bioLines.push(line);
    }
  }
  flush();

  return results;
}

export function loadInstructorSeedRows(
  markdownPath = DEFAULT_MARKDOWN_PATH
): InstructorSeedRow[] {
  const content = readFileSync(markdownPath, "utf8");
  return parseInstructorsMarkdown(content);
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/** Seed instructor bios from bundled markdown. Idempotent. */
export async function seedInstructors(
  markdownPath = DEFAULT_MARKDOWN_PATH
): Promise<{ upserted: number }> {
  const db = requireDb();
  const rows = loadInstructorSeedRows(markdownPath);
  let upserted = 0;

  for (const row of rows) {
    let existing = null;

    if (row.seedKey) {
      const [bySeedKey] = await db
        .select()
        .from(instructors)
        .where(eq(instructors.seedKey, row.seedKey))
        .limit(1);
      existing = bySeedKey ?? null;
    }

    if (!existing) {
      const [byName] = await db
        .select()
        .from(instructors)
        .where(eq(instructors.name, row.name))
        .limit(1);
      existing = byName ?? null;
    }

    if (existing) {
      await db
        .update(instructors)
        .set({
          name: row.name,
          bio: row.bio,
          seedKey: row.seedKey,
          sortOrder: row.sortOrder,
          isActive: true,
          updatedDate: new Date(),
        })
        .where(eq(instructors.id, existing.id));
    } else {
      await db.insert(instructors).values({
        name: row.name,
        bio: row.bio,
        seedKey: row.seedKey,
        sortOrder: row.sortOrder,
        isActive: true,
      });
    }
    upserted += 1;
  }

  return { upserted };
}
