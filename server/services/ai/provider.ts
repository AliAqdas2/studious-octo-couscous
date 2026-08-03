import type {
  StructuredCompletionRequest,
  StructuredCompletionResult,
} from "./types.js";

export interface AiProvider {
  readonly name: string;
  structuredComplete<T = unknown>(
    req: StructuredCompletionRequest
  ): Promise<StructuredCompletionResult<T>>;
}
