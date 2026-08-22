import { z } from "zod";
import {
  type ModelCompletion,
  type ModelProvider,
  type ResolvedModelRequest,
  ModelGatewayError,
} from "./model-gateway";

const openAiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().min(1) }),
    }),
  ).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

export interface OpenAiCompatibleProviderOptions {
  id: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

/**
 * Адаптер OpenAI-compatible Chat Completions. Ключ остаётся только в
 * server-side environment; приложение получает исключительно ModelRouter.
 */
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAiCompatibleProviderOptions) {
    if (!options.id.trim() || !options.baseUrl.trim() || !options.apiKey.trim()) {
      throw new ModelGatewayError("configuration", "Model provider id, base URL and API key are required");
    }
    const parsedBaseUrl = new URL(options.baseUrl);
    if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.protocol !== "http:") {
      throw new ModelGatewayError("configuration", "Model provider base URL must use HTTP(S)");
    }
    this.id = options.id;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async complete(request: ResolvedModelRequest): Promise<ModelCompletion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          ...(request.maxOutputTokens ? { max_completion_tokens: request.maxOutputTokens } : {}),
          ...(request.structuredOutput
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: request.structuredOutput.name,
                    strict: true,
                    schema: request.structuredOutput.schema,
                  },
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new ModelGatewayError(
          "request_failed",
          `Model provider returned HTTP ${response.status}: ${responseText.slice(0, 500)}`,
        );
      }
      const parsed = openAiResponseSchema.safeParse(JSON.parse(responseText));
      if (!parsed.success) {
        throw new ModelGatewayError("response_invalid", "Model provider returned an invalid completion shape");
      }
      const firstChoice = parsed.data.choices[0];
      if (!firstChoice) {
        throw new ModelGatewayError("response_invalid", "Model provider returned no completion choices");
      }
      const usage = parsed.data.usage;
      return {
        text: firstChoice.message.content,
        providerId: this.id,
        model: request.model,
        requestId: request.requestId,
        usage: {
          providerId: this.id,
          model: request.model,
          promptTokens: usage?.prompt_tokens ?? null,
          completionTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
          estimatedCostUsd: null,
        },
      };
    } catch (error) {
      if (error instanceof ModelGatewayError) throw error;
      if (error instanceof SyntaxError) {
        throw new ModelGatewayError("response_invalid", "Model provider returned malformed JSON");
      }
      const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "request failed";
      throw new ModelGatewayError("request_failed", `Model provider ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
