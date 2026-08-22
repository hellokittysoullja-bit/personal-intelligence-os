export const capabilityProfiles = [
  "reasoning_high",
  "reasoning_standard",
  "coding_high",
  "coding_fast",
  "vision_browser",
  "research_long_context",
  "verification_strict",
  "classification_cheap",
  "summarization_fast",
] as const;

export type CapabilityProfile = (typeof capabilityProfiles)[number];
export type ModelRole = "system" | "user" | "assistant";

export interface ModelMessage {
  role: ModelRole;
  content: string;
}

/** JSON Schema, задающая строгую структуру ответа модели. */
export interface StructuredOutputSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface ModelRequest {
  capability: CapabilityProfile;
  messages: ModelMessage[];
  structuredOutput?: StructuredOutputSchema;
  maxOutputTokens?: number;
  traceId?: string;
}

export interface ResolvedModelRequest extends ModelRequest {
  model: string;
  requestId: string;
}

export interface UsageReport {
  providerId: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface ModelCompletion {
  text: string;
  providerId: string;
  model: string;
  requestId: string;
  usage: UsageReport;
}

/** Реализации лежат только в infrastructure packages. */
export interface ModelProvider {
  readonly id: string;
  complete(request: ResolvedModelRequest): Promise<ModelCompletion>;
}

/** Application запрашивает capability, а не конкретное имя модели. */
export interface ModelRouter {
  complete(request: ModelRequest): Promise<ModelCompletion>;
}
