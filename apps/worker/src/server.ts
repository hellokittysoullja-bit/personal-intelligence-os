import { healthResponseSchema } from "@pios/contracts";
import { pingDatabase, type DatabaseClient } from "@pios/database";
import type { Logger } from "@pios/observability";
import Fastify from "fastify";

export interface BuildServerOptions {
  logger: Logger;
  db: DatabaseClient;
}

/**
 * apps/worker в Milestone 1 — процесс-заглушка без диспетчеризации миссий
 * (см. docs/ARCHITECTURE.md §1.4 — диспетчеризация через Postgres
 * LISTEN/NOTIFY появляется в Milestone 2, без внешней очереди до M10).
 * Единственная задача сейчас — доказать, что процесс поднимается,
 * подключается к Postgres и корректно завершается.
 *
 * Возвращаемый тип намеренно не аннотирован явно как FastifyInstance —
 * см. пояснение в apps/api/src/server.ts.
 */
export function buildServer({ logger, db }: BuildServerOptions) {
  const app = Fastify({ loggerInstance: logger });

  app.get("/health/live", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      service: "worker",
      time: new Date().toISOString(),
    });
  });

  app.get("/health/ready", async (_request, reply) => {
    const postgresOk = await pingDatabase(db.sql);
    const body = healthResponseSchema.parse({
      status: postgresOk ? "ok" : "degraded",
      service: "worker",
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
