import { randomUUID } from "node:crypto";

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

/** JSON Schema, передаваемая провайдеру для строгого структурированного ответа. */
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

export interface ModelProvider {
  readonly id: string;
  complete(request: ResolvedModelRequest): Promise<ModelCompletion>;
}

export interface ModelRouter {
  complete(request: ModelRequest): Promise<ModelCompletion>;
}

export interface CapabilityRoute {
  capability: CapabilityProfile;
  providerId: string;
  model: string;
}

export class ModelGatewayError extends Error {
  constructor(
    public readonly code: "configuration" | "request_failed" | "response_invalid",
    message: string,
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}

/**
 * Конфигурационный роутер. Application слой запрашивает capability, а не имя
 * конкретной модели. Отсутствующая или неверная конфигурация контролируемо
 * останавливает генерацию до совершения каких-либо внешних write-действий.
 */
export class ConfiguredModelRouter implements ModelRouter {
  private readonly providers = new Map<string, ModelProvider>();
  private readonly routes = new Map<CapabilityProfile, CapabilityRoute>();

  constructor(providers: ModelProvider[], routes: CapabilityRoute[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.id)) {
        throw new ModelGatewayError("configuration", `Duplicate model provider: ${provider.id}`);
      }
      this.providers.set(provider.id, provider);
    }

    for (const route of routes) {
      if (this.routes.has(route.capability)) {
        throw new ModelGatewayError("configuration", `Duplicate route: ${route.capability}`);
      }
      if (!this.providers.has(route.providerId)) {
        throw new ModelGatewayError("configuration", `Unknown model provider: ${route.providerId}`);
      }
      if (route.model.trim().length === 0) {
        throw new ModelGatewayError("configuration", `Model is required for ${route.capability}`);
      }
      this.routes.set(route.capability, route);
    }
  }

  async complete(request: ModelRequest): Promise<ModelCompletion> {
    if (request.messages.length === 0) {
      throw new ModelGatewayError("configuration", "At least one model message is required");
    }
    const route = this.routes.get(request.capability);
    if (!route) {
      throw new ModelGatewayError("configuration", `No route configured for ${request.capability}`);
    }
    const provider = this.providers.get(route.providerId);
    if (!provider) {
      throw new ModelGatewayError("configuration", `Unknown model provider: ${route.providerId}`);
    }

    return provider.complete({
      ...request,
      model: route.model,
      requestId: randomUUID(),
    });
  }
}

/** Детерминированный provider для unit-тестов application-логики. */
export class FakeModelProvider implements ModelProvider {
  readonly requests: ResolvedModelRequest[] = [];

  constructor(
    public readonly id: string,
    private readonly responses: Array<{ text: string; usage?: Partial<Omit<UsageReport, "providerId" | "model">> }>,
  ) {}

  async complete(request: ResolvedModelRequest): Promise<ModelCompletion> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new ModelGatewayError("request_failed", "Fake model provider has no queued response");
    }
    return {
      text: response.text,
      providerId: this.id,
      model: request.model,
      requestId: request.requestId,
      usage: {
        providerId: this.id,
        model: request.model,
        promptTokens: response.usage?.promptTokens ?? null,
        completionTokens: response.usage?.completionTokens ?? null,
        totalTokens: response.usage?.totalTokens ?? null,
        estimatedCostUsd: response.usage?.estimatedCostUsd ?? null,
      },
    };
  }
}
