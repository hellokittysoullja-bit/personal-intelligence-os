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

/** В Milestone 3 research planner создаёт фиксированный безопасный task graph. */
export function createTaskRepository(executor: Executor): TaskRepository {
  return {
    async create(task) {
      await executor.insert(tasks).values({
        id: task.id,
        missionId: task.missionId,
        parentTaskId: task.parentTaskId,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        status: task.status,
        dependencies: task.dependencies,
        assignedAgentJobId: task.assignedAgentJobId,
        inputArtifactIds: task.inputArtifactIds,
        outputArtifactIds: task.outputArtifactIds,
        successCriteria: task.successCriteria,
        evidenceRequirements: task.evidenceRequirements,
        maxAttempts: task.maxAttempts,
        attemptCount: task.attemptCount,
        timeoutMs: task.timeoutMs,
        budget: task.budget,
        version: task.version,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      });
    },
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
