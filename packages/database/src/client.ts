import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseClient {
  db: Database;
  /** Низкоуровневый клиент — нужен, например, для pingDatabase и graceful shutdown. */
  sql: postgres.Sql;
}

/**
 * Единственная точка создания подключения к PostgreSQL (docs/ARCHITECTURE.md
 * §1.3, ADR-007). apps/api и apps/worker создают ровно один DatabaseClient
 * на процесс и закрывают его при graceful shutdown.
 */
export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
