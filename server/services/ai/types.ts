export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface StructuredCompletionRequest {
  system?: string;
  user: string;
  jsonSchema: JsonSchemaObject;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredCompletionResult<T = unknown> {
  data: T;
  rawText?: string;
  model: string;
  provider: string;
}
