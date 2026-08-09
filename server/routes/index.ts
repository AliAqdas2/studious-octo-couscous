import type { Express } from "express";
import authRouter from "./auth.js";
import calendarRouter from "./calendar.js";
import callsRouter from "./calls.js";
import entitiesRouter from "./entities/index.js";
import filesRouter from "./files.js";
import gmailRouter from "./gmail.js";
import healthRouter from "./health.js";
import leadsCreateEventRouter from "./leads-create-event.js";
import leadsSearchRouter from "./leads-search.js";
import gmailWebhookRouter from "./webhooks/gmail.js";
import twilioWebhookRouter from "./webhooks/twilio.js";

export function registerRoutes(app: Express): void {
  // Webhooks — no JWT
  app.use("/webhook/twilio", twilioWebhookRouter);
  app.use("/webhook/gmail", gmailWebhookRouter);

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", leadsSearchRouter);
  app.use("/api", leadsCreateEventRouter);
  app.use("/api", gmailRouter);
  app.use("/api", calendarRouter);
  app.use("/api", callsRouter);
  app.use("/api", filesRouter);
  app.use("/api", entitiesRouter);

  app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}

