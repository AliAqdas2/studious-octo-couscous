import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";
import { emailTemplates } from "../server/db/schema/index.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve CSV for tsx (scripts/data) and Docker (cwd/scripts/data). */
function resolveCsvPath(): string {
  const candidates = [
    // Prefer Base44 export if present (often fresher than curated file)
    join(__dirname, "data", "EmailTemplate_export (1).csv"),
    join(process.cwd(), "scripts", "data", "EmailTemplate_export (1).csv"),
    join(__dirname, "data", "email-templates.csv"),
    join(process.cwd(), "scripts", "data", "email-templates.csv"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `[seed-email-templates] CSV not found. Tried:\n  ${candidates.join("\n  ")}`
  );
}

const VALID_CHANNELS = new Set(["B2C", "B2B", "Both"]);
const VALID_CUSTOMER_TYPES = new Set([
  "Doesn't matter",
  "New",
  "Old",
  "Referred",
]);
const VALID_CATEGORIES = new Set([
  "Lead Follow-Up",
  "Survey",
  "Reminder",
  "Proposal",
  "Event Confirmation",
  "Post-Event",
  "Re-Engagement",
]);
const VALID_SEND_MODES = new Set(["send", "draft"]);

/** Minimal RFC4180 CSV parser (handles quoted multiline fields). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.length > 0) || rows.length === 0) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = (cols[i] ?? "").trim();
    }
    return obj;
  });
}

function parseBool(raw: string, defaultValue: boolean): boolean {
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

type TemplateRow = {
  templateName: string;
  subject: string;
  body: string;
  pipelineStage: string | null;
  channel: "B2C" | "B2B" | "Both";
  customerType: "Doesn't matter" | "New" | "Old" | "Referred";
  category:
    | "Lead Follow-Up"
    | "Survey"
    | "Reminder"
    | "Proposal"
    | "Event Confirmation"
    | "Post-Event"
    | "Re-Engagement"
    | null;
  isActive: boolean;
  sendAutomatically: boolean;
  sendMode: "send" | "draft";
};

function mapCsvRow(raw: Record<string, string>): TemplateRow | null {
  const templateName = (raw.template_name || "").trim();
  const subject = (raw.subject || "").trim();
  const body = raw.body || "";
  if (!templateName || !subject || !body.trim()) {
    return null;
  }

  const channelRaw = (raw.channel || "").trim();
  const channel = VALID_CHANNELS.has(channelRaw)
    ? (channelRaw as TemplateRow["channel"])
    : "Both";

  const customerRaw = (raw.customer_type || "").trim();
  const customerType = VALID_CUSTOMER_TYPES.has(customerRaw)
    ? (customerRaw as TemplateRow["customerType"])
    : "Doesn't matter";

  const categoryRaw = (raw.category || "").trim();
  const category = VALID_CATEGORIES.has(categoryRaw)
    ? (categoryRaw as NonNullable<TemplateRow["category"]>)
    : null;

  const sendModeRaw = (raw.send_mode || "").trim();
  const sendMode = VALID_SEND_MODES.has(sendModeRaw)
    ? (sendModeRaw as TemplateRow["sendMode"])
    : "send";

  const pipelineStage = (raw.pipeline_stage || "").trim() || null;

  return {
    templateName,
    subject,
    body,
    pipelineStage,
    channel,
    customerType,
    category,
    isActive: parseBool(raw.is_active || "", true),
    sendAutomatically: parseBool(raw.send_automatically || "", false),
    sendMode,
  };
}

async function seedEmailTemplates(): Promise<void> {
  const csvPath = resolveCsvPath();
  console.log("[seed-email-templates] Starting");
  console.log(`[seed-email-templates] CSV=${csvPath}`);

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("[seed-email-templates] DATABASE_URL is not set");
  }

  const db = getDb();
  if (!db) {
    throw new Error("[seed-email-templates] getDb() returned null");
  }

  await db.execute(sql`select 1`);
  console.log("[seed-email-templates] Database connection OK");

  const text = readFileSync(csvPath, "utf8");
  const csvRows = parseCsv(text);
  console.log(`[seed-email-templates] Parsed ${csvRows.length} CSV row(s)`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of csvRows) {
    const row = mapCsvRow(raw);
    if (!row) {
      skipped++;
      console.warn(
        `[seed-email-templates] SKIP incomplete row: name=${raw.template_name || "(empty)"}`
      );
      continue;
    }

    const stageCond = row.pipelineStage
      ? eq(emailTemplates.pipelineStage, row.pipelineStage)
      : or(
          isNull(emailTemplates.pipelineStage),
          eq(emailTemplates.pipelineStage, "")
        );

    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(and(eq(emailTemplates.templateName, row.templateName), stageCond))
      .limit(1);

    const values = {
      templateName: row.templateName,
      subject: row.subject,
      body: row.body,
      pipelineStage: row.pipelineStage,
      channel: row.channel,
      customerType: row.customerType,
      category: row.category,
      isActive: row.isActive,
      sendAutomatically: row.sendAutomatically,
      sendMode: row.sendMode,
      updatedDate: new Date(),
    };

    if (existing) {
      await db
        .update(emailTemplates)
        .set(values)
        .where(eq(emailTemplates.id, existing.id));
      updated++;
      console.log(
        `[seed-email-templates] UPDATED "${row.templateName}" (${row.pipelineStage || "no stage"})`
      );
    } else {
      await db.insert(emailTemplates).values({
        ...values,
        createdBy: null,
      });
      inserted++;
      console.log(
        `[seed-email-templates] INSERTED "${row.templateName}" (${row.pipelineStage || "no stage"})`
      );
    }
  }

  console.log(
    `[seed-email-templates] Done inserted=${inserted} updated=${updated} skipped=${skipped}`
  );
}

seedEmailTemplates()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(
      "[seed-email-templates] Failed:",
      err instanceof Error ? err.message : err
    );
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
