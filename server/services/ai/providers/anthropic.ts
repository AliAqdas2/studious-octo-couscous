import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../../../lib/errors.js";
import type { AiProvider } from "../provider.js";
import type {
  StructuredCompletionRequest,
  StructuredCompletionResult,
} from "../types.js";

function jsonSchemaToAnthropicInputSchema(
  schema: StructuredCompletionRequest["jsonSchema"]
): Anthropic.Tool.InputSchema {
  return {
    type: "object",
    properties: schema.properties as Record<string, unknown>,
    required: schema.required,
  };
}

export function createAnthropicProvider(params: {
  apiKey: string;
  model: string;
}): AiProvider {
  const client = new Anthropic({ apiKey: params.apiKey });
  const model = params.model;

  return {
    name: "anthropic",
    async structuredComplete<T = unknown>(
      req: StructuredCompletionRequest
    ): Promise<StructuredCompletionResult<T>> {
      const toolName = req.schemaName || "structured_output";
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user",
          content: req.user,
        },
      ];

      const hasSystem = Boolean(req.system?.trim());

      // Explicit breakpoint on the last *static* block (tools → system → user).
      // Tools are included in the prefix hash when system is marked; only mark
      // tools when there is no system prompt.
      const tools: Anthropic.Tool[] = [
        {
          name: toolName,
          description:
            "Return the structured classification and extraction result as JSON matching the schema.",
          input_schema: jsonSchemaToAnthropicInputSchema(req.jsonSchema),
          ...(hasSystem
            ? {}
            : { cache_control: { type: "ephemeral" as const } }),
        },
      ];

      const system: Anthropic.TextBlockParam[] | undefined = hasSystem
        ? [
            {
              type: "text",
              text: req.system!,
              cache_control: { type: "ephemeral" },
            },
          ]
        : undefined;

      const response = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0,
        // Top-level automatic caching (docs). Combined with the explicit
        // static-prefix breakpoint above so classify/analyze can hit cache
        // across varying user messages.
        cache_control: { type: "ephemeral" },
        system,
        tools,
        tool_choice: { type: "tool", name: toolName },
        messages,
      });

      const toolBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolBlock) {
        throw new AppError("Anthropic did not return structured tool output", 502);
      }

      const usageRaw = response.usage as {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };

      const cacheCreate = usageRaw?.cache_creation_input_tokens ?? 0;
      const cacheRead = usageRaw?.cache_read_input_tokens ?? 0;
      if (cacheCreate === 0 && cacheRead === 0) {
        console.warn(
          `[anthropic] Prompt cache unused (cache_create=0 cache_read=0 model=${model}). ` +
            "Cached prefix may be under the model minimum token threshold."
        );
      }

      return {
        data: toolBlock.input as T,
        model,
        provider: "anthropic",
        usage: {
          inputTokens: usageRaw?.input_tokens ?? 0,
          outputTokens: usageRaw?.output_tokens ?? 0,
          cacheCreationInputTokens: cacheCreate,
          cacheReadInputTokens: cacheRead,
        },
      };
    },
  };
}
