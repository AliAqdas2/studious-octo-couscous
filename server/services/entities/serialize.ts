export function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function toApiRecord(row: Record<string, unknown>): Record<string, unknown> {
  const isUserRow = "passwordHash" in row || "inviteToken" in row || "inviteExpiresAt" in row;
  const passwordSet = Boolean(row.passwordHash);
  const invitePending =
    !passwordSet && Boolean(row.inviteToken || row.inviteExpiresAt);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "passwordHash" || key === "inviteToken") {
      continue;
    }
    const snake = toSnakeCase(key);
    if (value instanceof Date) {
      out[snake] = value.toISOString();
    } else {
      out[snake] = value;
    }
  }

  if (isUserRow) {
    out.password_set = passwordSet;
    out.invite_pending = invitePending;
  }

  return out;
}

export function fromApiBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) {
      continue;
    }
    out[toCamelCase(key)] = value;
  }
  return out;
}
