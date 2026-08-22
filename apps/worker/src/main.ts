import path from "node:path";
import dotenv from "dotenv";
import { createReconcileDurableJobs } from "@pios/application";
import { createDatabaseClient, createUnitOfWork } from "@pios/database";
import { createLogger } from "@pios/observability";
import { loadEnv } from "./env";
import { buildServer } from "./server";
import { startRecoveryLoop } from "./recovery-loop";

const SHUTDOWN_TIMEOUT_MS = 10_000;

// Локальная разработка: .env лежит в корне монорепозитория, не в apps/worker —
// ищем его явно, а не полагаемся на dotenv/config (который смотрит только в cwd).
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ service: "worker", level: env.LOG_LEVEL });
  const db = createDatabaseClient(env.DATABASE_URL);
  const app = buildServer({ logger, db });
  const reconcile = createReconcileDurableJobs(createUnitOfWork(db.db));

  await app.listen({ port: env.WORKER_PORT, host: "0.0.0.0" });
  const recoveryLoop = startRecoveryLoop({
    reconcile,
    intervalMs: env.WORKER_RECONCILE_INTERVAL_MS,
    logger,
  });
  logger.info(
    { port: env.WORKER_PORT },
    "apps/worker started (reconciliation-only; no queued job execution or external actions)",
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "apps/worker received shutdown signal");

    const forceExitTimer = setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
      recoveryLoop.stop();
      await app.close();
      await db.sql.end({ timeout: 5 });
      clearTimeout(forceExitTimer);
      logger.info("apps/worker shut down cleanly");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "error during apps/worker shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch((error: unknown) => {
  console.error("apps/worker failed to start:", error);
  process.exit(1);
});
