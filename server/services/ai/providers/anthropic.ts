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

      const response = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0,
        system: req.system,
        tools: [
          {
            name: toolName,
            description:
              "Return the structured classification and extraction result as JSON matching the schema.",
            input_schema: jsonSchemaToAnthropicInputSchema(req.jsonSchema),
          },
        ],
        tool_choice: { type: "tool", name: toolName },
        messages,
      });

      const toolBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolBlock) {
        throw new AppError("Anthropic did not return structured tool output", 502);
      }

      return {
        data: toolBlock.input as T,
        model,
        provider: "anthropic",
      };
    },
  };
}
