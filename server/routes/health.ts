import { Router } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ status: "degraded", database: "not_configured" });
    return;
  }

  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", database: "up" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(503).json({ status: "degraded", database: "down", error: message });
  }
});

export default router;
