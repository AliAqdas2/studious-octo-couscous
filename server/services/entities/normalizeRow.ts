import type { Table } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { toSnakeCase } from "./serialize.js";

interface DrizzleColumnMeta {
  name?: string;
  dataType?: string;
  columnType?: string;
  enumValues?: readonly string[];
  getSQLType?: () => string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() === "";
}

function fieldLabel(key: string): string {
  return toSnakeCase(key);
}

function getColumnMeta(column: unknown): DrizzleColumnMeta | null {
  if (!column || typeof column !== "object") {
    return null;
  }
  return column as DrizzleColumnMeta;
}

function isTableColumn(key: string, column: unknown): boolean {
  if (!column || typeof column !== "object") {
    return false;
  }
  // Drizzle table columns are objects with name / columnType; skip relations helpers etc.
  const meta = column as DrizzleColumnMeta;
  return typeof meta.name === "string" || typeof meta.columnType === "string";
}

function isEnumColumn(meta: DrizzleColumnMeta): boolean {
  return (
    meta.columnType === "PgEnumColumn" ||
    meta.columnType === "PgEnumObjectColumn" ||
    Array.isArray(meta.enumValues)
  );
}

function isUuidColumn(meta: DrizzleColumnMeta): boolean {
  if (meta.columnType === "PgUUID") {
    return true;
  }
  if (typeof meta.getSQLType === "function") {
    return meta.getSQLType().toLowerCase() === "uuid";
  }
  return false;
}

function isDateColumn(meta: DrizzleColumnMeta): boolean {
  if (
    meta.dataType === "date" ||
    meta.columnType === "PgTimestamp" ||
    meta.columnType === "PgTimestampString" ||
    meta.columnType === "PgDate" ||
    meta.columnType === "PgDateString"
  ) {
    return true;
  }
  if (typeof meta.getSQLType === "function") {
    const sqlType = meta.getSQLType().toLowerCase();
    return sqlType.includes("timestamp") || sqlType === "date";
  }
  return false;
}

function isNumberColumn(meta: DrizzleColumnMeta): boolean {
  if (
    meta.columnType === "PgInteger" ||
    meta.columnType === "PgSmallInt" ||
    meta.columnType === "PgBigInt53" ||
    meta.columnType === "PgBigInt64" ||
    meta.columnType === "PgReal" ||
    meta.columnType === "PgDoublePrecision" ||
    meta.columnType === "PgNumeric"
  ) {
    return true;
  }
  if (typeof meta.getSQLType === "function") {
    const sqlType = meta.getSQLType().toLowerCase();
    return (
      sqlType.includes("int") ||
      sqlType.includes("numeric") ||
      sqlType.includes("real") ||
      sqlType.includes("double") ||
      sqlType.includes("decimal")
    );
  }
  return meta.dataType === "number";
}

function isBooleanColumn(meta: DrizzleColumnMeta): boolean {
  if (meta.columnType === "PgBoolean" || meta.dataType === "boolean") {
    return true;
  }
  if (typeof meta.getSQLType === "function") {
    return meta.getSQLType().toLowerCase() === "boolean";
  }
  return false;
}

function isJsonColumn(meta: DrizzleColumnMeta): boolean {
  if (meta.columnType === "PgJson" || meta.columnType === "PgJsonb") {
    return true;
  }
  if (typeof meta.getSQLType === "function") {
    const sqlType = meta.getSQLType().toLowerCase();
    return sqlType === "json" || sqlType === "jsonb";
  }
  return false;
}

function normalizeEnum(
  key: string,
  value: unknown,
  meta: DrizzleColumnMeta
): unknown {
  const allowed = meta.enumValues ?? [];

  if (value === null || value === undefined) {
    return null;
  }

  if (isBlankString(value)) {
    // Only keep "" when the enum explicitly includes empty string (e.g. ai_flag_category)
    if (allowed.includes("")) {
      return "";
    }
    return null;
  }

  const asString = String(value);
  if (!allowed.includes(asString)) {
    const listed =
      allowed.length > 0
        ? allowed.map((v) => (v === "" ? "(empty)" : v)).join(", ")
        : "(none)";
    throw new AppError(
      `Invalid value for ${fieldLabel(key)}: "${asString}". Allowed: ${listed}`,
      400
    );
  }
  return asString;
}

function normalizeUuid(key: string, value: unknown): unknown {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  const asString = String(value);
  if (!UUID_RE.test(asString)) {
    throw new AppError(`Invalid UUID for ${fieldLabel(key)}: "${asString}"`, 400);
  }
  return asString;
}

function normalizeDate(key: string, value: unknown): unknown {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AppError(`Invalid date for ${fieldLabel(key)}`, 400);
    }
    return value;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      `Invalid date for ${fieldLabel(key)}: "${String(value)}"`,
      400
    );
  }
  return parsed;
}

function normalizeNumber(key: string, value: unknown): unknown {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new AppError(`Invalid number for ${fieldLabel(key)}`, 400);
    }
    return value;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new AppError(
      `Invalid number for ${fieldLabel(key)}: "${String(value)}"`,
      400
    );
  }
  return parsed;
}

function normalizeBoolean(key: string, value: unknown): unknown {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === "false" || value === 0 || value === "0") {
    return false;
  }
  throw new AppError(
    `Invalid boolean for ${fieldLabel(key)}: "${String(value)}"`,
    400
  );
}

function normalizeJson(key: string, value: unknown): unknown {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new AppError(`Invalid JSON for ${fieldLabel(key)}`, 400);
    }
  }
  return value;
}

function normalizeColumnValue(
  key: string,
  value: unknown,
  meta: DrizzleColumnMeta
): unknown {
  if (isEnumColumn(meta)) {
    return normalizeEnum(key, value, meta);
  }
  if (isUuidColumn(meta)) {
    return normalizeUuid(key, value);
  }
  if (isDateColumn(meta)) {
    return normalizeDate(key, value);
  }
  if (isNumberColumn(meta)) {
    return normalizeNumber(key, value);
  }
  if (isBooleanColumn(meta)) {
    return normalizeBoolean(key, value);
  }
  if (isJsonColumn(meta)) {
    return normalizeJson(key, value);
  }
  // varchar / text — empty string is valid
  return value;
}

/**
 * Schema-aware coercion + validation before Drizzle insert/update.
 * Drops unknown keys; converts form "unset" empty strings to null for enums/uuids/dates/numbers.
 */
export function normalizeRowForDb(
  table: Table,
  data: Record<string, unknown>,
  options: { stripId?: boolean } = {}
): Record<string, unknown> {
  const columns = table as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const stripId = options.stripId !== false;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (stripId && key === "id") {
      continue;
    }
    if (!isTableColumn(key, columns[key])) {
      continue;
    }
    const meta = getColumnMeta(columns[key]);
    if (!meta) {
      continue;
    }
    out[key] = normalizeColumnValue(key, value, meta);
  }

  return out;
}

/** Map leftover Postgres driver errors into client-facing AppErrors when possible. */
export function mapPostgresWriteError(err: unknown): never {
  const root =
    err && typeof err === "object" && "cause" in err
      ? (err as { cause: unknown }).cause
      : err;

  const code =
    root && typeof root === "object" && "code" in root
      ? String((root as { code: unknown }).code)
      : "";
  const message =
    root instanceof Error
      ? root.message
      : err instanceof Error
        ? err.message
        : String(err);

  if (code === "22P02" || message.includes("invalid input value for enum")) {
    throw new AppError(
      message.replace(/^.*PostgresError:\s*/i, "").split("\n")[0] ||
        "Invalid value for database column",
      400
    );
  }

  if (code === "23505" || message.includes("duplicate key")) {
    throw new AppError("A record with that unique value already exists", 409);
  }

  if (code === "23503") {
    throw new AppError("Referenced record does not exist", 400);
  }

  throw err;
}
