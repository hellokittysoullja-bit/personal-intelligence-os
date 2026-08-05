import { createDatabaseClient } from "@pios/database";
import { createLogger } from "@pios/observability";
import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("apps/api health endpoints", () => {
  it("GET /health/live returns 200 without touching the database", async () => {
    const logger = createLogger({ service: "api-test", level: "silent" });
    const db = createDatabaseClient("postgres://invalid:invalid@127.0.0.1:1/invalid");
    const app = buildServer({ logger, db });

    const response = await app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "api" });

    await app.close();
    await db.sql.end({ timeout: 1 });
  });

  it("GET /health/ready returns 503 when Postgres is unreachable", async () => {
    const logger = createLogger({ service: "api-test", level: "silent" });
    const db = createDatabaseClient("postgres://invalid:invalid@127.0.0.1:1/invalid");
    const app = buildServer({ logger, db });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "degraded" });

    await app.close();
    await db.sql.end({ timeout: 1 });
  }, 10_000);

  it.skipIf(!process.env.DATABASE_URL)(
    "GET /health/ready returns 200 when Postgres is reachable",
    async () => {
      const logger = createLogger({ service: "api-test", level: "silent" });
      const db = createDatabaseClient(process.env.DATABASE_URL as string);
      const app = buildServer({ logger, db });

      const response = await app.inject({ method: "GET", url: "/health/ready" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "ok", service: "api" });

      await app.close();
      await db.sql.end({ timeout: 1 });
    },
    10_000,
  );
});
