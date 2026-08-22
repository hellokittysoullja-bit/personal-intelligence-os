import { blockForRecovery, type UnitOfWork } from "@pios/domain";

/**
 * Реализация ADR-010 для первого worker-среза. Пока нет ToolExecutor,
 * поэтому исход running job не угадывается и никогда не ретраится сам.
 */
export function createReconcileDurableJobs(unitOfWork: UnitOfWork) {
  return async function reconcileDurableJobs(now = new Date().toISOString()) {
    return unitOfWork.run(async (ctx) => {
      const expired = await ctx.durableJobs.listExpiredRunning(now);
      const blockedIds: string[] = [];
      for (const job of expired) {
        const blocked = blockForRecovery(job, now);
        if (await ctx.durableJobs.update(blocked)) blockedIds.push(blocked.id);
      }
      return { blockedIds };
    });
  };
}

export type ReconcileDurableJobs = ReturnType<typeof createReconcileDurableJobs>;
