import type { DurableJob, DurableJobRepository } from "@pios/domain";
import { and, eq, lt } from "drizzle-orm";
import type { Executor } from "./client";
import { durableJobs } from "./schema";

function toDomain(row: typeof durableJobs.$inferSelect): DurableJob {
  return {
    id: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    jobType: row.jobType as DurableJob["jobType"],
    payload: row.payload,
    status: row.status as DurableJob["status"],
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function values(job: DurableJob) {
  return {
    ownerId: job.ownerId,
    missionId: job.missionId,
    jobType: job.jobType,
    payload: job.payload,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    leaseOwner: job.leaseOwner,
    leaseExpiresAt: job.leaseExpiresAt ? new Date(job.leaseExpiresAt) : null,
    lastHeartbeatAt: job.lastHeartbeatAt ? new Date(job.lastHeartbeatAt) : null,
    lastError: job.lastError,
    updatedAt: new Date(job.updatedAt),
  };
}

export function createDurableJobRepository(executor: Executor): DurableJobRepository {
  return {
    async create(job) {
      await executor.insert(durableJobs).values({
        id: job.id,
        ...values(job),
        createdAt: new Date(job.createdAt),
      });
    },
    async listExpiredRunning(now) {
      const rows = await executor
        .select()
        .from(durableJobs)
        .where(and(eq(durableJobs.status, "running"), lt(durableJobs.leaseExpiresAt, new Date(now))));
      return rows.map(toDomain);
    },
    async update(job) {
      const updated = await executor
        .update(durableJobs)
        .set(values(job))
        .where(and(eq(durableJobs.id, job.id), eq(durableJobs.status, "running")))
        .returning({ id: durableJobs.id });
      return updated.length === 1;
    },
  };
}
