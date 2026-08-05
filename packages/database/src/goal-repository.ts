import type { Goal, GoalPriority, GoalRepository, GoalStatus } from "@pios/domain";
import { eq } from "drizzle-orm";
import type { Executor } from "./client";
import { goals } from "./schema";

function toDomain(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    ownerId: row.ownerId,
    rawRequest: row.rawRequest,
    inferredIntent: row.inferredIntent,
    desiredOutcome: row.desiredOutcome,
    parentGoalId: row.parentGoalId,
    priority: row.priority as GoalPriority,
    status: row.status as GoalStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createGoalRepository(executor: Executor): GoalRepository {
  return {
    async create(goal) {
      await executor.insert(goals).values({
        id: goal.id,
        ownerId: goal.ownerId,
        rawRequest: goal.rawRequest,
        inferredIntent: goal.inferredIntent,
        desiredOutcome: goal.desiredOutcome,
        parentGoalId: goal.parentGoalId,
        priority: goal.priority,
        status: goal.status,
        createdAt: new Date(goal.createdAt),
        updatedAt: new Date(goal.updatedAt),
      });
    },
    async getById(id) {
      const rows = await executor.select().from(goals).where(eq(goals.id, id)).limit(1);
      return rows[0] ? toDomain(rows[0]) : null;
    },
  };
}
