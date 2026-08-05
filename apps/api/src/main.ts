import path from "node:path";
import dotenv from "dotenv";
import { createDatabaseClient } from "@pios/database";
import { createLogger } from "@pios/observability";
import { loadEnv } from "./env";
import { buildServer } from "./server";

const SHUTDOWN_TIMEOUT_MS = 10_000;

// Локальная разработка: .env лежит в корне монорепозитория, не в apps/api —
// ищем его явно, а не полагаемся на dotenv/config (который смотрит только в cwd).
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ service: "api", level: env.LOG_LEVEL });
  const db = createDatabaseClient(env.DATABASE_URL);
  const app = buildServer({ logger, db });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  logger.info({ port: env.API_PORT }, "apps/api started");

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "apps/api received shutdown signal");

    const forceExitTimer = setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
      await app.close();
      await db.sql.end({ timeout: 5 });
      clearTimeout(forceExitTimer);
      logger.info("apps/api shut down cleanly");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "error during apps/api shutdown");
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
  console.error("apps/api failed to start:", error);
  process.exit(1);
});
