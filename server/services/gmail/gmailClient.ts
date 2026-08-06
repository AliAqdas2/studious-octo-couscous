import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { gmailConnections, gmailPollState } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.googleClientId() && env.googleClientSecret());
}

export function createOAuth2Client() {
  if (!isGoogleOAuthConfigured()) {
    throw new AppError(
      "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      503
    );
  }
  return new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret(),
    env.googleRedirectUri()
  );
}

export function getOAuthConsentUrl(state?: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: state || undefined,
  });
}

export async function getGmailConnection() {
  const db = requireDb();
  const rows = await db.select().from(gmailConnections).limit(1);
  return rows[0] ?? null;
}

export async function getGmailStatus(): Promise<{
  connected: boolean;
  email: string | null;
  watchExpiration: string | null;
  watchRegisteredAt: string | null;
  lastConnectionError: string | null;
}> {
  const db = requireDb();
  const row = await getGmailConnection();
  const pollRows = await db
    .select()
    .from(gmailPollState)
    .where(eq(gmailPollState.key, "default"))
    .limit(1);
  const poll = pollRows[0] ?? null;
  const watchExpiration = poll?.watchExpiration
    ? poll.watchExpiration.toISOString()
    : null;
  const watchRegisteredAt = poll?.watchRegisteredAt
    ? poll.watchRegisteredAt.toISOString()
    : null;
  const lastConnectionError = poll?.lastConnectionError || null;

  if (!row) {
    return {
      connected: false,
      email: null,
      watchExpiration,
      watchRegisteredAt,
      lastConnectionError,
    };
  }
  return {
    connected: true,
    email: row.email,
    watchExpiration,
    watchRegisteredAt,
    lastConnectionError,
  };
}

/**
 * Revoke Google token (best-effort), delete shared connection, clear watch state.
 */
export async function disconnectGmail(): Promise<{ ok: true }> {
  const db = requireDb();
  const connection = await getGmailConnection();

  if (connection) {
    try {
      const client = createOAuth2Client();
      const tokenToRevoke =
        connection.refreshToken || connection.accessToken || "";
      if (tokenToRevoke) {
        await client.revokeToken(tokenToRevoke);
      }
    } catch (err) {
      console.warn(
        "[gmail] Token revoke failed (continuing disconnect):",
        err instanceof Error ? err.message : err
      );
    }

    await db
      .delete(gmailConnections)
      .where(eq(gmailConnections.id, connection.id));
  }

  const now = new Date();
  const pollRows = await db
    .select()
    .from(gmailPollState)
    .where(eq(gmailPollState.key, "default"))
    .limit(1);
  if (pollRows[0]) {
    await db
      .update(gmailPollState)
      .set({
        watchExpiration: null,
        watchRegisteredAt: null,
        lastConnectionError: null,
        disconnectAlertSentAt: null,
        updatedDate: now,
      })
      .where(eq(gmailPollState.id, pollRows[0].id));
  }

  return { ok: true };
}

export async function saveOAuthTokens(params: {
  code: string;
  userId?: string | null;
}): Promise<{ email: string }> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(params.code);
  if (!tokens.access_token) {
    throw new AppError("Google did not return an access token", 502);
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  const email = me.data.email || env.gmailSenderEmail() || "unknown";

  const db = requireDb();
  const existing = await getGmailConnection();
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : null;
  const now = new Date();

  if (existing) {
    await db
      .update(gmailConnections)
      .set({
        userId: params.userId ?? existing.userId,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existing.refreshToken,
        expiresAt,
        updatedDate: now,
      })
      .where(eq(gmailConnections.id, existing.id));
  } else {
    await db.insert(gmailConnections).values({
      userId: params.userId ?? null,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
    });
  }

  return { email };
}

async function refreshAndPersist(
  connectionId: string,
  refreshToken: string
): Promise<string> {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new AppError("Failed to refresh Gmail access token", 502);
  }

  const db = requireDb();
  await db
    .update(gmailConnections)
    .set({
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : null,
      updatedDate: new Date(),
    })
    .where(eq(gmailConnections.id, connectionId));

  return credentials.access_token;
}

/**
 * Force-refresh the stored OAuth access token.
 * Used by the hourly health job to keep the refresh token from going stale.
 */
export async function forceRefreshGmailToken(): Promise<{
  ok: true;
  email: string;
  expiresAt: string | null;
}> {
  const connection = await getGmailConnection();
  if (!connection) {
    throw new AppError("Gmail not connected", 503);
  }
  if (!connection.refreshToken) {
    throw new AppError(
      "Gmail has no refresh token. Reconnect via /api/gmail/oauth/start",
      503
    );
  }

  await refreshAndPersist(connection.id, connection.refreshToken);

  const updated = await getGmailConnection();
  return {
    ok: true,
    email: connection.email,
    expiresAt: updated?.expiresAt ? updated.expiresAt.toISOString() : null,
  };
}

/** Authenticated Gmail API client for the shared CRM mailbox. */
export async function getGmailApi() {
  const connection = await getGmailConnection();
  if (!connection) {
    throw new AppError(
      "Gmail not connected. Connect via /api/gmail/oauth/start",
      503
    );
  }

  let accessToken = connection.accessToken;
  const expiresSoon =
    connection.expiresAt &&
    connection.expiresAt.getTime() < Date.now() + 60_000;

  if (expiresSoon) {
    if (!connection.refreshToken) {
      throw new AppError(
        "Gmail token expired. Reconnect via /api/gmail/oauth/start",
        503
      );
    }
    accessToken = await refreshAndPersist(
      connection.id,
      connection.refreshToken
    );
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: connection.refreshToken || undefined,
  });

  return google.gmail({ version: "v1", auth: client });
}

export function encodeRawMessage(rfc2822: string): string {
  return Buffer.from(rfc2822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}
