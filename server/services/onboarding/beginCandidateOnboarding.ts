import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, candidates } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { inviteUser } from "../auth/inviteUser.js";
import { toApiRecord } from "../entities/serialize.js";
import { ensureCandidateWorkflowSteps } from "./createCandidate.js";
import type { JobRole } from "./constants.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export async function beginCandidateOnboarding(candidateId: string): Promise<{
  candidate: Record<string, unknown>;
  user: Record<string, unknown>;
  inviteUrl: string;
  emailSent: boolean;
}> {
  const db = requireDb();

  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!row) {
    throw new AppError("Candidate not found", 404);
  }

  if (row.stage !== "Offer Accepted") {
    throw new AppError(
      `Cannot begin onboarding from stage "${row.stage}". Expected "Offer Accepted".`,
      400
    );
  }

  const email = row.email?.trim();
  if (!email) {
    throw new AppError("Candidate email is required to send login details", 400);
  }

  const inviteResult = await inviteUser({
    email,
    full_name: row.name,
    phone: row.phone,
    role: "user",
    operational_role: "Onboarding",
  });

  const now = new Date();
  let updated;
  try {
    [updated] = await db
      .update(candidates)
      .set({
        stage: "Onboarding",
        userId: inviteResult.user.id as string,
        updatedDate: now,
      })
      .where(eq(candidates.id, candidateId))
      .returning();
  } catch (e) {
    throw new AppError("Failed to update candidate", 500, {
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent,
    });
  }

  if (!updated) {
    throw new AppError("Failed to update candidate", 500, {
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent,
    });
  }

  try {
    await db.insert(activityLogs).values({
      entityType: "Candidate",
      entityId: candidateId,
      action: "Onboarding started — login sent",
      details: {
        user_id: inviteResult.user.id,
        email_sent: inviteResult.emailSent,
        invite_url: inviteResult.inviteUrl,
      },
      userName: "System (Recruitment)",
      timestamp: now,
    });
  } catch (e) {
    console.warn(
      "[begin-onboarding] ActivityLog insert failed:",
      e instanceof Error ? e.message : e
    );
  }

  await ensureCandidateWorkflowSteps(
    candidateId,
    updated.jobRole as JobRole
  );

  return {
    candidate: toApiRecord(updated as unknown as Record<string, unknown>),
    user: inviteResult.user,
    inviteUrl: inviteResult.inviteUrl,
    emailSent: inviteResult.emailSent,
  };
}
