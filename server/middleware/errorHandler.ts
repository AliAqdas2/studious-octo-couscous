import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

function extractPostgresCode(err: unknown): string | null {
  if (!err || typeof err !== "object") {
    return null;
  }
  if ("code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  if ("cause" in err) {
    return extractPostgresCode((err as { cause: unknown }).cause);
  }
  return null;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.extras ?? {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  const pgCode = extractPostgresCode(err);
  const message = err instanceof Error ? err.message : "Internal server error";

  if (pgCode === "22P02" || message.includes("invalid input value for enum")) {
    const cleaned =
      message.replace(/^.*PostgresError:\s*/i, "").split("\n")[0] ||
      "Invalid value for database column";
    res.status(400).json({ error: cleaned });
    return;
  }

  if (pgCode === "23505") {
    res.status(409).json({ error: "A record with that unique value already exists" });
    return;
  }

  if (pgCode === "23503") {
    res.status(400).json({ error: "Referenced record does not exist" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: message });
}
