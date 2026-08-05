import type { Task, TaskRepository, TaskStatus } from "@pios/domain";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { tasks } from "./schema";

function toDomain(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    missionId: row.missionId,
    parentTaskId: row.parentTaskId,
    title: row.title,
    description: row.description,
    taskType: row.taskType,
    status: row.status as TaskStatus,
    dependencies: row.dependencies,
    assignedAgentJobId: row.assignedAgentJobId,
    inputArtifactIds: row.inputArtifactIds,
    outputArtifactIds: row.outputArtifactIds,
    successCriteria: row.successCriteria,
    evidenceRequirements: row.evidenceRequirements,
    maxAttempts: row.maxAttempts,
    attemptCount: row.attemptCount,
    timeoutMs: row.timeoutMs,
    budget: row.budget,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** В Milestone 2 задачи ещё не создаются (планировщик — Milestone 4), поэтому
 * репозиторий пока только читает — write-путь появится вместе с PLAN. */
export function createTaskRepository(executor: Executor): TaskRepository {
  return {
    async listByMission(missionId) {
      const rows = await executor
        .select()
        .from(tasks)
        .where(eq(tasks.missionId, missionId))
        .orderBy(asc(tasks.createdAt));
      return rows.map(toDomain);
    },
  };
}
