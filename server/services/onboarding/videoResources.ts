import type { OnboardingStepResource } from "../../db/schema/onboarding-workflow-steps.js";

/** Local training video paths (served from /videos with auth). */
export const LOCAL_TRAINING_VIDEOS: Record<
  string,
  { slug: string; url: string; label: string }
> = {
  "1dAx70_cl9OcjWmvNuf9moOoHwJWSNj94": {
    slug: "fareharbor-beo",
    url: "/videos/Fareharbor%26BEO.mp4",
    label: "FareHarbor & BEO",
  },
  "1gRYUVT_i29FVcYmrqd1trFsPRYD-AtaS": {
    slug: "invoice-template",
    url: "/videos/InvoiceTemplate.mp4",
    label: "Invoice template",
  },
  "1XR8tALSU2tS1pkxWxaT-9-59sfU25CIL": {
    slug: "mangia-structure",
    url: "/videos/Mangia%20Structure.mp4",
    label: "Mangia Structure",
  },
};

const LOCAL_BY_PATH: Record<string, string> = {
  "fareharbor&beo.mp4": "/videos/Fareharbor%26BEO.mp4",
  "invoicetemplate.mp4": "/videos/InvoiceTemplate.mp4",
  "mangia structure.mp4": "/videos/Mangia%20Structure.mp4",
};

const SLUG_BY_LOCAL_URL: Record<string, string> = {
  "/videos/Fareharbor%26BEO.mp4": "fareharbor-beo",
  "/videos/InvoiceTemplate.mp4": "invoice-template",
  "/videos/Mangia%20Structure.mp4": "mangia-structure",
};

function driveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match?.[1] ?? null;
}

export function resolveOnboardingVideoUrls(
  resources: OnboardingStepResource[] | null | undefined
): OnboardingStepResource[] {
  if (!Array.isArray(resources)) return [];

  return resources.map((resource) => {
    if (resource.type !== "video" || !resource.url) {
      return resource;
    }

    if (resource.url.startsWith("/videos/")) {
      return {
        ...resource,
        slug: resource.slug ?? SLUG_BY_LOCAL_URL[resource.url],
      };
    }

    const fileId = driveFileId(resource.url);
    if (fileId && LOCAL_TRAINING_VIDEOS[fileId]) {
      const local = LOCAL_TRAINING_VIDEOS[fileId];
      return {
        ...resource,
        slug: resource.slug ?? local.slug,
        url: local.url,
        label: resource.label || local.label,
      };
    }

    const pathKey = resource.url.split("/").pop()?.toLowerCase() ?? "";
    if (LOCAL_BY_PATH[pathKey]) {
      return { ...resource, url: LOCAL_BY_PATH[pathKey] };
    }

    return resource;
  });
}

export interface VideoProgressNotes {
  videoProgress?: Record<string, { watched: boolean; watchedAt?: string }>;
}

export function parseVideoProgressNotes(
  notes: string | null | undefined
): VideoProgressNotes {
  if (!notes?.trim()) return {};
  try {
    const parsed = JSON.parse(notes) as VideoProgressNotes;
    if (parsed && typeof parsed === "object" && parsed.videoProgress) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

export function getVideoResources(
  resources: OnboardingStepResource[] | null | undefined
): OnboardingStepResource[] {
  const resolved = resolveOnboardingVideoUrls(resources);
  return resolved.filter(
    (r) =>
      r.type === "video" &&
      r.url?.startsWith("/videos/") &&
      Boolean(r.slug)
  );
}

export function countWatchedVideos(
  resources: OnboardingStepResource[] | null | undefined,
  notes: string | null | undefined
): { watched: number; total: number; allWatched: boolean } {
  const videos = getVideoResources(resources);
  const progress = parseVideoProgressNotes(notes).videoProgress ?? {};
  const watched = videos.filter((v) => v.slug && progress[v.slug]?.watched).length;
  return {
    watched,
    total: videos.length,
    allWatched: videos.length > 0 && watched === videos.length,
  };
}
