import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const baseEnv = {
  DATABASE_URL: "postgres://pios:pios@localhost:5432/pios",
};

describe("api environment", () => {
  it("разрешает локальную разработку без API_AUTH_TOKEN", () => {
    expect(envSchema.safeParse(baseEnv).success).toBe(true);
  });

  it("не разрешает production без API_AUTH_TOKEN", () => {
    const parsed = envSchema.safeParse({ ...baseEnv, NODE_ENV: "production" });
    expect(parsed.success).toBe(false);
  });

  it("разрешает production с достаточно длинным API_AUTH_TOKEN", () => {
    const parsed = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: "production",
      API_AUTH_TOKEN: "01234567890123456789012345678901",
    });
    expect(parsed.success).toBe(true);
  });
});
