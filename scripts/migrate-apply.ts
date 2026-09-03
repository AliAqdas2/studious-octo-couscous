import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresOptions, resolveDatabaseUrl } from "../server/db/config.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(databaseUrl, getPostgresOptions(databaseUrl));

  try {
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const names = new Set(tables.map((row) => String(row.table_name)));

    if (!names.has("users")) {
      console.log("Applying initial schema (0000)...");
      const initial = readFileSync(
        join(__dirname, "../drizzle/0000_open_omega_flight.sql"),
        "utf8"
      );
      for (const statement of initial.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed) {
          await sql.unsafe(trimmed);
        }
      }
      console.log("Initial schema applied");
    } else {
      console.log("Base tables already present");
    }

    const columns = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
    `;
    const userCols = new Set(columns.map((row) => String(row.column_name)));

    if (!names.has("refresh_tokens") || !userCols.has("password_hash")) {
      console.log("Applying auth migration (0001)...");
      const authSql = readFileSync(
        join(__dirname, "../drizzle/0001_chunky_songbird.sql"),
        "utf8"
      );
      for (const statement of authSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("Auth migration applied");
    } else {
      console.log("Auth columns and refresh_tokens already present");
    }

    if (!names.has("gmail_connections")) {
      console.log("Applying gmail_connections migration (0002)...");
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "gmail_connections" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid,
          "email" varchar(255) NOT NULL,
          "access_token" text NOT NULL,
          "refresh_token" text,
          "expires_at" timestamptz,
          "created_date" timestamptz DEFAULT now() NOT NULL,
          "updated_date" timestamptz DEFAULT now() NOT NULL
        );
      `);
      try {
        await sql.unsafe(`
          ALTER TABLE "gmail_connections"
          ADD CONSTRAINT "gmail_connections_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
          ON DELETE set null ON UPDATE no action;
        `);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          !message.includes("already exists") &&
          !message.includes("duplicate")
        ) {
          throw err;
        }
        console.log(`Skipping FK (already applied): ${message.split("\n")[0]}`);
      }
      console.log("gmail_connections migration applied");
    } else {
      console.log("gmail_connections already present");
    }

    // Refresh table list after possible 0002 create
    const tablesAfter = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const namesAfter = new Set(tablesAfter.map((row) => String(row.table_name)));

    const pollCols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'gmail_poll_state'
    `;
    const pollColNames = new Set(pollCols.map((row) => String(row.column_name)));

    const needsPasswordReset = !namesAfter.has("password_reset_codes");
    const needsWatchCols = !pollColNames.has("watch_expiration");

    if (needsPasswordReset || needsWatchCols) {
      console.log("Applying password reset + gmail watch migration (0003)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0003_password_reset_and_gmail_watch.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("password reset + gmail watch migration applied");
    } else {
      console.log("password_reset_codes and gmail watch columns already present");
    }

    const tablesFinal = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const namesFinal = new Set(tablesFinal.map((row) => String(row.table_name)));

    const needsIntakeRetry =
      !namesFinal.has("gmail_intake_retries") ||
      !namesFinal.has("gmail_intake_dead_letters");

    if (needsIntakeRetry) {
      console.log("Applying gmail intake retry migration (0004)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0004_gmail_intake_retry.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("gmail intake retry migration applied");
    } else {
      console.log("gmail_intake_retries and gmail_intake_dead_letters already present");
    }

    // Re-read poll columns after possible earlier migrations
    const pollColsAfter = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'gmail_poll_state'
    `;
    const pollColNamesAfter = new Set(
      pollColsAfter.map((row) => String(row.column_name))
    );
    const needsDeadLetterAlertDedup = !pollColNamesAfter.has(
      "dead_letter_alert_sent_at"
    );

    if (needsDeadLetterAlertDedup) {
      console.log("Applying gmail dead-letter alert dedup migration (0005)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0005_gmail_dead_letter_alert_dedup.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("gmail dead-letter alert dedup migration applied");
    } else {
      console.log("gmail_poll_state dead-letter alert columns already present");
    }

    const tablesOnboarding = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const namesOnboarding = new Set(
      tablesOnboarding.map((row) => String(row.table_name))
    );
    const needsOnboarding =
      !namesOnboarding.has("candidates") ||
      !namesOnboarding.has("onboarding_workflow_templates") ||
      !namesOnboarding.has("candidate_steps");

    if (needsOnboarding) {
      console.log("Applying onboarding candidates migration (0006)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0006_onboarding_candidates.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("onboarding candidates migration applied");
    } else {
      console.log("onboarding candidate tables already present");
    }

    const indexRows = await sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in ('activity_logs_timestamp_idx', 'call_logs_status_ended_at_idx')
    `;
    const indexNames = new Set(indexRows.map((row) => String(row.indexname)));
    const needsAiLogsIndexes =
      !indexNames.has("activity_logs_timestamp_idx") ||
      !indexNames.has("call_logs_status_ended_at_idx");

    if (needsAiLogsIndexes) {
      console.log("Applying AI logs indexes migration (0007)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0007_ai_logs_indexes.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("AI logs indexes migration applied");
    } else {
      console.log("AI logs indexes already present");
    }

    const candidateUserCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidates'
        and column_name = 'user_id'
    `;
    const needsOnboardingUserLink = candidateUserCol.length === 0;

    if (needsOnboardingUserLink) {
      console.log("Applying onboarding user link migration (0008)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0008_onboarding_user_link.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("onboarding user link migration applied");
    } else {
      console.log("candidates.user_id already present");
    }

    const statusEnumRows = await sql`
      select e.enumlabel
      from pg_type t
      join pg_enum e on t.oid = e.enumtypid
      where t.typname = 'gmail_message_status'
    `;
    const statusLabels = new Set(
      statusEnumRows.map((row) => String(row.enumlabel))
    );
    if (!statusLabels.has("processing")) {
      console.log("Applying gmail intake processing status (0009)...");
      await sql.unsafe(
        `ALTER TYPE "gmail_message_status" ADD VALUE IF NOT EXISTS 'processing'`
      );
      console.log("gmail intake processing status applied");
    } else {
      console.log("gmail_message_status processing already present");
    }

    const workflowTables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('event_workflow_templates', 'event_workflow_task_defs')
    `;
    const workflowNames = new Set(
      workflowTables.map((row) => String(row.table_name))
    );
    const eventCols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'workflow_template_id'
    `;
    const needsEventWorkflow =
      !workflowNames.has("event_workflow_templates") ||
      !workflowNames.has("event_workflow_task_defs") ||
      eventCols.length === 0;

    if (needsEventWorkflow) {
      console.log("Applying event workflow foundation migration (0010)...");
      const migSql = readFileSync(
        join(__dirname, "../drizzle/0010_event_workflow_foundation.sql"),
        "utf8"
      );
      for (const statement of migSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("event workflow foundation migration applied");
    } else {
      console.log("event workflow foundation tables/columns already present");
    }

    const taskMetaCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tasks'
        and column_name = 'workflow_meta'
    `;
    if (taskMetaCol.length === 0) {
      console.log("Applying task workflow_meta migration (0011)...");
      await sql.unsafe(
        `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_meta" jsonb DEFAULT '{}'::jsonb`
      );
      console.log("task workflow_meta migration applied");
    } else {
      console.log("tasks.workflow_meta already present");
    }

    const vendorsTable = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'vendors'
    `;
    if (vendorsTable.length === 0) {
      console.log("Applying inventory and vendors migration (0012)...");
      const invSql = readFileSync(
        join(__dirname, "../drizzle/0012_inventory_and_vendors.sql"),
        "utf8"
      );
      for (const statement of invSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("inventory and vendors migration applied");
    } else {
      console.log("vendors / inventory tables already present");
    }

    const postEventCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'post_event'
    `;
    if (postEventCol.length === 0) {
      console.log("Applying post-event + features migration (0013)...");
      const peSql = readFileSync(
        join(__dirname, "../drizzle/0013_post_event_and_features.sql"),
        "utf8"
      );
      for (const statement of peSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("post-event + features migration applied");
    } else {
      console.log("events.post_event already present");
      await sql.unsafe(
        `ALTER TABLE "automation_config" ADD COLUMN IF NOT EXISTS "event_ops_features" jsonb DEFAULT '{}'::jsonb`
      );
    }

    const tmplDocCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_workflow_templates'
        and column_name = 'doc_quality'
    `;
    if (tmplDocCol.length === 0) {
      console.log("Applying multi-experience templates migration (0014)...");
      const mxSql = readFileSync(
        join(__dirname, "../drizzle/0014_multi_experience_templates.sql"),
        "utf8"
      );
      for (const statement of mxSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("multi-experience templates migration applied");
    } else {
      console.log("event_workflow_templates.doc_quality already present");
    }

    const venuesTable = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = 'venues'
    `;
    const leadVenueCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leads'
        and column_name = 'venue'
    `;
    if (venuesTable.length === 0 || leadVenueCol.length === 0) {
      console.log("Applying venues + lead venue migration (0015)...");
      const venuesSql = readFileSync(
        join(__dirname, "../drizzle/0015_venues_and_lead_venue.sql"),
        "utf8"
      );
      for (const statement of venuesSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("venues + lead venue migration applied");
    } else {
      console.log("venues table and leads.venue already present");
    }

    const catalogExpKeysCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'inventory_catalog_items'
        and column_name = 'experience_keys'
    `;
    const catalogExpKeyCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'inventory_catalog_items'
        and column_name = 'experience_key'
    `;
    if (catalogExpKeysCol.length === 0 || catalogExpKeyCol.length > 0) {
      console.log("Applying catalog experience_keys migration (0016)...");
      const expKeysSql = readFileSync(
        join(__dirname, "../drizzle/0016_catalog_experience_keys.sql"),
        "utf8"
      );
      for (const statement of expKeysSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate") ||
            message.includes("does not exist")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("catalog experience_keys migration applied");
    } else {
      console.log("inventory_catalog_items.experience_keys already present");
    }

    const beoDocHtmlCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'beo_document_html'
    `;
    if (beoDocHtmlCol.length === 0) {
      console.log("Applying BEO document migration (0017)...");
      const beoDocSql = readFileSync(
        join(__dirname, "../drizzle/0017_beo_document.sql"),
        "utf8"
      );
      for (const statement of beoDocSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("BEO document migration applied");
    } else {
      console.log("events.beo_document_html already present");
    }

    const catalogSectionCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'inventory_catalog_items'
        and column_name = 'section'
    `;
    if (catalogSectionCol.length === 0) {
      console.log("Applying inventory catalog sections migration (0018)...");
      const sectionsSql = readFileSync(
        join(__dirname, "../drizzle/0018_inventory_catalog_sections.sql"),
        "utf8"
      );
      for (const statement of sectionsSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("inventory catalog sections migration applied");
    } else {
      console.log("inventory_catalog_items.section already present");
    }

    const venueImagesTable = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'venue_images'
    `;
    if (venueImagesTable.length === 0) {
      console.log("Applying venue images migration (0019)...");
      const venueImagesSql = readFileSync(
        join(__dirname, "../drizzle/0019_venue_images.sql"),
        "utf8"
      );
      for (const statement of venueImagesSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("venue images migration applied");
    } else {
      console.log("venue_images table already present");
    }

    const instructorsTable = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'instructors'
    `;
    if (instructorsTable.length === 0) {
      console.log("Applying instructors migration (0020)...");
      const instructorsSql = readFileSync(
        join(__dirname, "../drizzle/0020_instructors.sql"),
        "utf8"
      );
      for (const statement of instructorsSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("instructors migration applied");
    } else {
      console.log("instructors table already present");
    }

    const eateriesTable = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'eateries'
    `;
    const venueGuidelinesCol = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venues'
        and column_name = 'guidelines'
    `;
    if (eateriesTable.length === 0 || venueGuidelinesCol.length === 0) {
      console.log("Applying eateries + BEO fields migration (0021)...");
      const eateriesSql = readFileSync(
        join(__dirname, "../drizzle/0021_eateries_and_beo_fields.sql"),
        "utf8"
      );
      for (const statement of eateriesSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("eateries + BEO fields migration applied");
    } else {
      console.log("eateries table and venues.guidelines already present");
    }

    const attendeesTable = await sql`
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'event_attendees'
    `;
    if (attendeesTable.length === 0) {
      console.log("Applying event attendees migration (0022)...");
      const attendeesSql = readFileSync(
        join(__dirname, "../drizzle/0022_event_attendees.sql"),
        "utf8"
      );
      for (const statement of attendeesSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("event attendees migration applied");
    } else {
      console.log("event_attendees table already present");
    }

    const foodTourEnum = await sql`
      select enumlabel
      from pg_enum e
      join pg_type t on e.enumtypid = t.oid
      where t.typname = 'event_type'
        and enumlabel = 'Private Food Tour'
    `;
    if (foodTourEnum.length === 0) {
      console.log("Applying food-tour event types migration (0023)...");
      const foodTourSql = readFileSync(
        join(__dirname, "../drizzle/0023_food_tour_event_types.sql"),
        "utf8"
      );
      for (const statement of foodTourSql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (!trimmed) continue;
        try {
          await sql.unsafe(trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            message.includes("already exists") ||
            message.includes("duplicate")
          ) {
            console.log(`Skipping (already applied): ${message.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      console.log("food-tour event types migration applied");
    } else {
      console.log("food-tour event_type values already present");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(() => {
    console.log("migrate-apply complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("migrate-apply failed:", err);
    process.exit(1);
  });
