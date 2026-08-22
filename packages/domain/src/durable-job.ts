import { z } from "zod";

export const durableJobTypeSchema = z.enum(["internal_noop", "read_only_reconcile"]);
export type DurableJobType = z.infer<typeof durableJobTypeSchema>;

export const durableJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "blocked_recovery",
  "cancelled",
]);
export type DurableJobStatus = z.infer<typeof durableJobStatusSchema>;

export const durableJobSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid().nullable(),
  jobType: durableJobTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  status: durableJobStatusSchema,
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  leaseOwner: z.string().min(1).nullable(),
  leaseExpiresAt: z.string().datetime().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastError: z.string().max(2_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DurableJob = z.infer<typeof durableJobSchema>;

/** Неидемпотентные и неизвестные work items при recovery должны блокироваться, а не повторяться. */
export function blockForRecovery(job: DurableJob, now = new Date().toISOString()): DurableJob {
  if (job.status !== "running") throw new Error(`Cannot recover job from ${job.status}`);
  return {
    ...job,
    status: "blocked_recovery",
    leaseOwner: null,
    leaseExpiresAt: null,
    lastHeartbeatAt: now,
    lastError: "Worker lease expired; outcome requires explicit reconciliation",
    updatedAt: now,
  };
}
