import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfiguredModelRouter,
  FakeModelProvider,
} from "./model-gateway";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConfiguredModelRouter", () => {
  it("маршрутизирует capability без раскрытия имени модели application-слою", async () => {
    const provider = new FakeModelProvider("test", [{ text: "{\"answer\":\"ok\"}" }]);
    const router = new ConfiguredModelRouter([provider], [
      { capability: "research_long_context", providerId: "test", model: "configured-model" },
    ]);

    const completion = await router.complete({
      capability: "research_long_context",
      messages: [{ role: "user", content: "Сформируй черновик" }],
    });

    expect(completion.model).toBe("configured-model");
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.model).toBe("configured-model");
  });

  it("контролируемо отклоняет capability без маршрута", async () => {
    const router = new ConfiguredModelRouter([new FakeModelProvider("test", [])], []);
    await expect(router.complete({ capability: "verification_strict", messages: [{ role: "user", content: "x" }] }))
      .rejects.toMatchObject({ code: "configuration" });
  });
});

describe("OpenAiCompatibleProvider", () => {
  it("передаёт strict JSON Schema и возвращает usage без ключа в результате", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "{\"answer\":\"ok\"}" } }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiCompatibleProvider({ id: "openai-compatible", baseUrl: "https://models.example/v1", apiKey: "secret" });

    const result = await provider.complete({
      capability: "research_long_context",
      model: "model-from-config",
      requestId: "request-1",
      messages: [{ role: "user", content: "Исследование" }],
      structuredOutput: { name: "research_report", schema: { type: "object", additionalProperties: false } },
    });

    expect(result.text).toBe("{\"answer\":\"ok\"}");
    expect(result.usage.totalTokens).toBe(18);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const sent = JSON.parse(firstCall?.[1].body as string) as Record<string, unknown>;
    expect(sent.model).toBe("model-from-config");
    expect(sent.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true, name: "research_report" } });
  });

  it("отклоняет malformed JSON от провайдера", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    const provider = new OpenAiCompatibleProvider({ id: "test", baseUrl: "https://models.example/v1", apiKey: "secret" });

    await expect(provider.complete({
      capability: "research_long_context", model: "configured", requestId: "request-1", messages: [{ role: "user", content: "x" }],
    })).rejects.toMatchObject({ code: "response_invalid" });
  });
});
