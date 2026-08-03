import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { AiProvider } from "./provider.js";
import { createAnthropicProvider } from "./providers/anthropic.js";

let cached: AiProvider | null = null;

export function isAiConfigured(): boolean {
  const provider = env.aiProvider();
  if (provider === "anthropic") {
    return Boolean(env.anthropicApiKey());
  }
  return false;
}

/** Factory — only place that selects the AI vendor from env. */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const provider = env.aiProvider();
  if (provider === "anthropic") {
    const apiKey = env.anthropicApiKey();
    if (!apiKey) {
      throw new AppError(
        "AI is not configured. Set ANTHROPIC_API_KEY (and optionally AI_MODEL).",
        503
      );
    }
    cached = createAnthropicProvider({
      apiKey,
      model: env.aiModel(),
    });
    return cached;
  }

  throw new AppError(
    `Unsupported AI_PROVIDER "${provider}". Supported: anthropic`,
    503
  );
}

/** Test helper — clear cached provider after env changes. */
export function resetAiProviderCache(): void {
  cached = null;
}
