import type postgres from "postgres";

/**
 * Проверка живости Postgres для /health/ready (docs/ARCHITECTURE.md §1.4).
 * Намеренно не зависит от наличия каких-либо таблиц — readiness не должна
 * ломаться из-за ещё не применённой миграции.
 */
export async function pingDatabase(sql: postgres.Sql, timeoutMs = 2000): Promise<boolean> {
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("database ping timeout")), timeoutMs),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}
