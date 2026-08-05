import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health";

describe("healthResponseSchema", () => {
  it("принимает валидный ответ", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      service: "api",
      time: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет неизвестный status", () => {
    const result = healthResponseSchema.safeParse({
      status: "definitely-not-valid",
      service: "api",
      time: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("отклоняет ответ без service", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      time: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
