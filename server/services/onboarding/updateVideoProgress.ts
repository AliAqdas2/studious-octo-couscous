import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { candidateSteps, candidates } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { toApiRecord } from "../entities/serialize.js";
import type { OnboardingStepResource } from "../../db/schema/onboarding-workflow-steps.js";
import {
  countWatchedVideos,
  getVideoResources,
  parseVideoProgressNotes,
  resolveOnboardingVideoUrls,
} from "./videoResources.js";

export async function updateVideoProgress(
  userId: string,
  stepId: string,
  input: { slug: string; watched: boolean }
): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 503);

  const slug = input.slug?.trim();
  if (!slug) throw new AppError("slug is required", 400);

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate || candidate.stage !== "Onboarding") {
    throw new AppError("Onboarding access required", 403);
  }

  const [step] = await db
    .select()
    .from(candidateSteps)
    .where(
      and(
        eq(candidateSteps.id, stepId),
        eq(candidateSteps.candidateId, candidate.id)
      )
    )
    .limit(1);

  if (!step) throw new AppError("Step not found", 404);
  if (step.stepType !== "video") {
    throw new AppError("This step does not support video progress", 400);
  }

  const resources = resolveOnboardingVideoUrls(
    (step.resources ?? []) as OnboardingStepResource[]
  );
  const videoSlugs = new Set(
    getVideoResources(resources)
      .map((v) => v.slug)
      .filter(Boolean) as string[]
  );

  if (!videoSlugs.has(slug)) {
    throw new AppError("Unknown video module", 400);
  }

  const existing = parseVideoProgressNotes(step.notes);
  const videoProgress = { ...(existing.videoProgress ?? {}) };

  if (input.watched) {
    videoProgress[slug] = {
      watched: true,
      watchedAt: new Date().toISOString(),
    };
  } else {
    delete videoProgress[slug];
  }

  const notesPayload = JSON.stringify({ videoProgress });
  const now = new Date();

  const [updated] = await db
    .update(candidateSteps)
    .set({
      notes: notesPayload,
      updatedDate: now,
    })
    .where(eq(candidateSteps.id, stepId))
    .returning();

  if (!updated) throw new AppError("Failed to update progress", 500);

  const apiStep = toApiRecord(updated as unknown as Record<string, unknown>);
  const stats = countWatchedVideos(resources, notesPayload);

  return {
    step: {
      ...apiStep,
      resources,
    },
    allVideosWatched: stats.allWatched,
    watchedCount: stats.watched,
    totalVideos: stats.total,
  };
}
