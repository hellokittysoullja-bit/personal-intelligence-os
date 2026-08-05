import { healthResponseSchema } from "@pios/contracts";
import { pingDatabase, type DatabaseClient } from "@pios/database";
import type { Logger } from "@pios/observability";
import Fastify from "fastify";

export interface BuildServerOptions {
  logger: Logger;
  db: DatabaseClient;
}

/**
 * /health/live — процесс жив, не проверяет зависимости.
 * /health/ready — процесс готов принимать нагрузку: проверяет Postgres
 * (docs/ARCHITECTURE.md §1.4, ROADMAP.md M1 критерии готовности).
 *
 * Возвращаемый тип намеренно не аннотирован явно как FastifyInstance:
 * Fastify({ loggerInstance }) инстанцирует generic-параметр логгера как
 * pino.Logger (а не дефолтный FastifyBaseLogger), поэтому тип должен быть
 * выведен, а не сужен обратно к несовместимому дефолту.
 */
export function buildServer({ logger, db }: BuildServerOptions) {
  const app = Fastify({ loggerInstance: logger });

  app.get("/health/live", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      service: "api",
      time: new Date().toISOString(),
    });
  });

  app.get("/health/ready", async (_request, reply) => {
    const postgresOk = await pingDatabase(db.sql);
    const body = healthResponseSchema.parse({
      status: postgresOk ? "ok" : "degraded",
      service: "api",
      time: new Date().toISOString(),
      checks: {
        postgres: postgresOk
          ? { ok: true }
          : { ok: false, message: "Postgres unreachable" },
      },
    });
    reply.code(postgresOk ? 200 : 503);
    return body;
  });

  return app;
}
