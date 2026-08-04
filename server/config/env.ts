import { config } from "dotenv";

config();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Add it to mangia-crm/.env (see .env.example).`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  jwtSecret: () => requireEnv("JWT_SECRET"),
  jwtRefreshSecret: () =>
    process.env.JWT_REFRESH_SECRET?.trim() || requireEnv("JWT_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL?.trim() || "15m",
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS) || 30,
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL?.trim() || "admin@mangia.com",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD?.trim() || "changeme",
  appUrl: () =>
    process.env.APP_URL?.trim() ||
    `http://localhost:${Number(process.env.PORT) || 5000}`,
  googleClientId: () => process.env.GOOGLE_CLIENT_ID?.trim() || "",
  googleClientSecret: () => process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
  googleRedirectUri: () =>
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `http://localhost:${Number(process.env.PORT) || 5000}/api/gmail/oauth/callback`,
  gmailSenderEmail: () => process.env.GMAIL_SENDER_EMAIL?.trim() || "",
  twilioAccountSid: () => process.env.TWILIO_ACCOUNT_SID?.trim() || "",
  twilioAuthToken: () => process.env.TWILIO_AUTH_TOKEN?.trim() || "",
  twilioPhoneNumber: () => process.env.TWILIO_PHONE_NUMBER?.trim() || "",
  aiProvider: () =>
    (process.env.AI_PROVIDER?.trim() || "anthropic").toLowerCase(),
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY?.trim() || "",
  aiModel: () =>
    process.env.AI_MODEL?.trim() || "claude-sonnet-4-20250514",
  gmailPubsubTopic: () => process.env.GMAIL_PUBSUB_TOPIC?.trim() || "",
  gmailWebhookSecret: () => process.env.GMAIL_WEBHOOK_SECRET?.trim() || "",
  enableJobs: () =>
    process.env.ENABLE_JOBS === "true" || process.env.ENABLE_JOBS === "1",
  /** Login / password-reset rate limits (5 / 15 min). Off unless explicitly enabled. */
  enableAuthRateLimit: () =>
    process.env.ENABLE_AUTH_RATE_LIMIT === "true" ||
    process.env.ENABLE_AUTH_RATE_LIMIT === "1",
  /** Comma-separated digest recipients; empty → Base44 team defaults. */
  digestRecipients: (): string[] => {
    const raw = process.env.DIGEST_RECIPIENTS?.trim();
    if (!raw) {
      return [
        "aa03095276332@gmail.com",
        "admin2@mangiadc.com",
        "info@mangiadc.com",
      ];
    }
    return raw
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
  },
};
