import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { getEntityDefinition, type EntityDefinition } from "./registry.js";
import { mapPostgresWriteError, normalizeRowForDb } from "./normalizeRow.js";
import { fromApiBody, toApiRecord, toCamelCase } from "./serialize.js";
import { scheduleOnLeadCreated } from "../leads/onLeadCreated.js";
import { detectReturningClient } from "../leads/detectReturningClient.js";
import {
  applyEnrichToLeadData,
  enrichLeadOnCreate,
  logAutoClassification,
} from "../leads/enrichLeadOnCreate.js";
import { syncClientMetrics } from "../clients/syncClientMetrics.js";

export interface ListQuery {
  sort?: string;
  limit?: number;
  offset?: number;
  format?: string;
  filters: Record<string, string | { gte?: string; lte?: string }>;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function getColumn(
  table: EntityDefinition["table"],
  snakeOrCamel: string
): unknown {
  const camel = toCamelCase(snakeOrCamel);
  const columns = table as unknown as Record<string, unknown>;
  return columns[camel] ?? null;
}

function parseListQuery(query: Record<string, unknown>): ListQuery {
  const filters: ListQuery["filters"] = {};

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("filter[") || value === undefined || value === null) {
      continue;
    }

    const inner = key.slice("filter[".length, -1);
    if (inner.endsWith("][gte") || inner.includes("][gte")) {
      const field = inner.replace("][gte", "").replace("[gte", "");
      const existing = filters[field];
      const range =
        typeof existing === "object" && existing !== null && !Array.isArray(existing)
          ? existing
          : {};
      filters[field] = { ...range, gte: String(value) };
      continue;
    }
    if (inner.endsWith("][lte") || inner.includes("][lte")) {
      const field = inner.replace("][lte", "").replace("[lte", "");
      const existing = filters[field];
      const range =
        typeof existing === "object" && existing !== null && !Array.isArray(existing)
          ? existing
          : {};
      filters[field] = { ...range, lte: String(value) };
      continue;
    }

    filters[inner] = String(value);
  }

  // Also support nested query objects from Express: filter[email]=x
  const filterObj = query.filter;
  if (filterObj && typeof filterObj === "object" && !Array.isArray(filterObj)) {
    for (const [field, value] of Object.entries(filterObj as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const range = value as { gte?: unknown; lte?: unknown };
        filters[field] = {
          gte: range.gte !== undefined ? String(range.gte) : undefined,
          lte: range.lte !== undefined ? String(range.lte) : undefined,
        };
      } else if (value !== undefined && value !== null) {
        filters[field] = String(value);
      }
    }
  }

  return {
    sort: typeof query.sort === "string" ? query.sort : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    offset: query.offset !== undefined ? Number(query.offset) : undefined,
    format: typeof query.format === "string" ? query.format : undefined,
    filters,
  };
}

function buildWhere(
  table: EntityDefinition["table"],
  filters: ListQuery["filters"]
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const [field, value] of Object.entries(filters)) {
    const column = getColumn(table, field) as Parameters<typeof eq>[0] | null;
    if (!column) {
      continue;
    }

    if (typeof value === "object" && value !== null) {
      if (value.gte !== undefined) {
        conditions.push(gte(column, coerceValue(value.gte)));
      }
      if (value.lte !== undefined) {
        conditions.push(lte(column, coerceValue(value.lte)));
      }
      continue;
    }

    if (value.includes(",")) {
      const parts = value.split(",").map((part) => coerceValue(part.trim()));
      conditions.push(inArray(column, parts));
    } else {
      conditions.push(eq(column, coerceValue(value)));
    }
  }

  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return and(...conditions);
}

function coerceValue(raw: string): string | number | boolean | Date {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return raw;
}

function orderByClause(table: EntityDefinition["table"], sort: string) {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  const column = getColumn(table, field) as Parameters<typeof asc>[0] | null;
  if (!column) {
    return null;
  }
  return descending ? desc(column) : asc(column);
}

function assertRequired(
  entityName: string,
  def: EntityDefinition,
  data: Record<string, unknown>
): void {
  if (!def.requiredOnCreate) {
    return;
  }
  for (const field of def.requiredOnCreate) {
    const camel = toCamelCase(field);
    if (data[camel] === undefined || data[camel] === null || data[camel] === "") {
      throw new AppError(`${entityName}: ${field} is required`, 400);
    }
  }
}

function sanitizeUserPayload(
  entityName: string,
  data: Record<string, unknown>,
  user: AuthUser,
  isCreate: boolean
): Record<string, unknown> {
  const next = { ...data };

  if (entityName === "users") {
    delete next.passwordHash;
    delete next.inviteToken;
    if (user.role !== "admin") {
      delete next.role;
      delete next.isActive;
    }
  }

  if (isCreate && "createdBy" in (getEntityDefinition(entityName)?.table ?? {})) {
    if (next.createdBy === undefined && user.role !== "admin") {
      next.createdBy = user.id;
    } else if (next.createdBy === undefined) {
      next.createdBy = user.id;
    }
  }

  if (!isCreate) {
    next.updatedDate = new Date();
  }

  return next;
}

export async function listEntities(
  entityName: string,
  query: Record<string, unknown>,
  user: AuthUser
) {
  const def = getEntityDefinition(entityName);
  if (!def) {
    throw new AppError(`Unknown entity: ${entityName}`, 404);
  }
  if (def.adminOnlyList && user.role !== "admin") {
    throw new AppError("Admin access required", 403);
  }

  const db = requireDb();
  const parsed = parseListQuery(query);
  const limit = Math.min(Math.max(parsed.limit ?? 100, 1), 5000);
  const offset = Math.max(parsed.offset ?? 0, 0);
  const sort = parsed.sort ?? def.defaultSort;
  const where = buildWhere(def.table, parsed.filters);
  const order = orderByClause(def.table, sort);

  const baseQuery = db.select().from(def.table);
  const filtered = where ? baseQuery.where(where) : baseQuery;
  const ordered = order ? filtered.orderBy(order) : filtered;
  const rows = await ordered.limit(limit).offset(offset);

  const countQuery = db.select({ value: count() }).from(def.table);
  const [{ value: total }] = where
    ? await countQuery.where(where)
    : await countQuery;

  const data = rows.map((row) => toApiRecord(row as Record<string, unknown>));

  if (parsed.format === "array") {
    return data;
  }

  return {
    data,
    total: Number(total),
    limit,
    offset,
  };
}

export async function getEntity(
  entityName: string,
  id: string,
  user: AuthUser
) {
  const def = getEntityDefinition(entityName);
  if (!def) {
    throw new AppError(`Unknown entity: ${entityName}`, 404);
  }
  if (def.adminOnlyList && user.role !== "admin" && user.id !== id) {
    throw new AppError("Admin access required", 403);
  }

  const db = requireDb();
  const idColumn = getColumn(def.table, "id") as Parameters<typeof eq>[0];
  const [row] = await db
    .select()
    .from(def.table)
    .where(eq(idColumn, id))
    .limit(1);

  if (!row) {
    throw new AppError("Not found", 404);
  }

  return toApiRecord(row as Record<string, unknown>);
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  const message = err instanceof Error ? err.message : String(err);
  return code === "23505" || message.includes("duplicate key") || message.includes("unique");
}

async function findByUniqueField(
  def: EntityDefinition,
  fieldSnake: string,
  value: unknown
): Promise<Record<string, unknown> | null> {
  const db = requireDb();
  const column = getColumn(def.table, fieldSnake) as Parameters<typeof eq>[0] | null;
  if (!column) {
    return null;
  }
  const [row] = await db
    .select()
    .from(def.table)
    .where(eq(column, value as never))
    .limit(1);
  return (row as Record<string, unknown> | undefined) ?? null;
}

export async function createEntity(
  entityName: string,
  body: Record<string, unknown>,
  user: AuthUser
) {
  const def = getEntityDefinition(entityName);
  if (!def) {
    throw new AppError(`Unknown entity: ${entityName}`, 404);
  }
  if (entityName === "users" && user.role !== "admin") {
    throw new AppError("Admin access required", 403);
  }

  const data = normalizeRowForDb(
    def.table,
    sanitizeUserPayload(entityName, fromApiBody(body), user, true),
    { stripId: true }
  );

  if (def.singletonKey) {
    const keyField = toCamelCase(def.singletonKey);
    if (data[keyField] === undefined || data[keyField] === null || data[keyField] === "") {
      data[keyField] = "default";
    }
  }

  assertRequired(entityName, def, data);

  const db = requireDb();

  let leadEnrich: Awaited<ReturnType<typeof enrichLeadOnCreate>> | null = null;
  if (entityName === "leads") {
    leadEnrich = await enrichLeadOnCreate({
      email: (data.email as string) || null,
      company: (data.company as string) || null,
      inquiryType: (data.inquiryType as string) || null,
      clientId: (data.clientId as string) || null,
      notes: (data.notes as string) || null,
      eventTypeInterest: (data.eventTypeInterest as string) || null,
      stage: (data.stage as string) || "New Inquiry",
      source: (data.source as string) || null,
    });
    applyEnrichToLeadData(data, leadEnrich);
  }

  if (def.singletonKey) {
    const keyField = toCamelCase(def.singletonKey);
    const keyValue = data[keyField];
    const existing = await findByUniqueField(def, def.singletonKey, keyValue);
    if (existing) {
      const updatePayload = normalizeRowForDb(
        def.table,
        {
          ...data,
          updatedDate: new Date(),
        },
        { stripId: true }
      );
      delete updatePayload.createdDate;
      delete updatePayload.createdBy;
      delete updatePayload[keyField];

      try {
        const idColumn = getColumn(def.table, "id") as Parameters<typeof eq>[0];
        const [updated] = await db
          .update(def.table)
          .set(updatePayload as never)
          .where(eq(idColumn, existing.id as string))
          .returning();
        return toApiRecord(updated as Record<string, unknown>);
      } catch (err) {
        mapPostgresWriteError(err);
      }
    }
  }

  if (def.idempotentUniqueField) {
    const uniqueCamel = toCamelCase(def.idempotentUniqueField);
    const uniqueValue = data[uniqueCamel];
    if (uniqueValue !== undefined && uniqueValue !== null && uniqueValue !== "") {
      const existing = await findByUniqueField(
        def,
        def.idempotentUniqueField,
        uniqueValue
      );
      if (existing) {
        return toApiRecord(existing);
      }
    }
  }

  try {
    const [row] = await db
      .insert(def.table)
      .values(data as never)
      .returning();
    const record = toApiRecord(row as Record<string, unknown>);
    if (entityName === "leads" && typeof record.id === "string") {
      if (leadEnrich) {
        await logAutoClassification(record.id, leadEnrich);
      }
      scheduleOnLeadCreated(record.id);
      try {
        await detectReturningClient(record.id);
        const refreshed = await findByUniqueField(def, "id", record.id);
        if (refreshed) {
          return toApiRecord(refreshed);
        }
      } catch (err) {
        console.warn(
          "[createEntity] detectReturningClient failed:",
          err instanceof Error ? err.message : err
        );
      }
    }
    return record;
  } catch (err) {
    if (def.idempotentUniqueField && isUniqueViolation(err)) {
      const uniqueCamel = toCamelCase(def.idempotentUniqueField);
      const existing = await findByUniqueField(
        def,
        def.idempotentUniqueField,
        data[uniqueCamel]
      );
      if (existing) {
        return toApiRecord(existing);
      }
    }
    mapPostgresWriteError(err);
  }
}

export async function updateEntity(
  entityName: string,
  id: string,
  body: Record<string, unknown>,
  user: AuthUser
) {
  const def = getEntityDefinition(entityName);
  if (!def) {
    throw new AppError(`Unknown entity: ${entityName}`, 404);
  }

  if (entityName === "users") {
    const isSelf = user.id === id;
    if (user.role !== "admin" && !isSelf) {
      throw new AppError("Forbidden", 403);
    }
  }

  const data = normalizeRowForDb(
    def.table,
    sanitizeUserPayload(entityName, fromApiBody(body), user, false),
    { stripId: true }
  );
  delete data.createdDate;
  delete data.createdBy;

  const db = requireDb();
  const idColumn = getColumn(def.table, "id") as Parameters<typeof eq>[0];
  try {
    const [row] = await db
      .update(def.table)
      .set(data as never)
      .where(eq(idColumn, id))
      .returning();

    if (!row) {
      throw new AppError("Not found", 404);
    }

    const record = toApiRecord(row as Record<string, unknown>);

    if (entityName === "events") {
      const stage = (row as { stage?: string }).stage;
      const clientId = (row as { clientId?: string | null }).clientId;
      if (stage === "Completed" && clientId) {
        try {
          await syncClientMetrics(clientId);
        } catch (err) {
          console.warn(
            "[updateEntity] syncClientMetrics failed:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return record;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    mapPostgresWriteError(err);
  }
}

export async function deleteEntity(
  entityName: string,
  id: string,
  user: AuthUser
) {
  const def = getEntityDefinition(entityName);
  if (!def) {
    throw new AppError(`Unknown entity: ${entityName}`, 404);
  }
  if (def.adminOnlyDelete && user.role !== "admin") {
    throw new AppError("Admin access required", 403);
  }
  if (entityName === "users" && user.id === id) {
    throw new AppError("Cannot delete yourself", 400);
  }

  const db = requireDb();
  const idColumn = getColumn(def.table, "id") as Parameters<typeof eq>[0];
  const [row] = await db
    .delete(def.table)
    .where(eq(idColumn, id))
    .returning();

  if (!row) {
    throw new AppError("Not found", 404);
  }

  return { ok: true };
}

export async function bulkCreateEntities(
  entityName: string,
  rows: Record<string, unknown>[],
  user: AuthUser
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("Expected a non-empty array of records", 400);
  }

  const created = [];
  for (const row of rows) {
    created.push(await createEntity(entityName, row, user));
  }
  return created;
}
