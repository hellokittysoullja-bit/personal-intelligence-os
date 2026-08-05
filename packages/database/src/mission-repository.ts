import type {
  AutonomyLevel,
  Mission,
  MissionPhase,
  MissionRepository,
  MissionStatus,
} from "@pios/domain";
import type { ActionRiskLevel } from "@pios/domain";
import { desc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { missions } from "./schema";

function toDomain(row: typeof missions.$inferSelect): Mission {
  return {
    id: row.id,
    ownerId: row.ownerId,
    goalId: row.goalId,
    title: row.title,
    objective: row.objective,
    status: row.status as MissionStatus,
    currentPhase: row.currentPhase as MissionPhase,
    autonomyLevel: row.autonomyLevel as AutonomyLevel,
    riskLevel: row.riskLevel as ActionRiskLevel,
    budget: row.budget,
    successCriteria: row.successCriteria,
    constraints: row.constraints,
    unknowns: row.unknowns,
    assumptions: row.assumptions,
    stopConditions: row.stopConditions,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    version: row.version,
  };
}

export function createMissionRepository(executor: Executor): MissionRepository {
  return {
    async create(mission) {
      await executor.insert(missions).values({
        id: mission.id,
        ownerId: mission.ownerId,
        goalId: mission.goalId,
        title: mission.title,
        objective: mission.objective,
        status: mission.status,
        currentPhase: mission.currentPhase,
        autonomyLevel: mission.autonomyLevel,
        riskLevel: mission.riskLevel,
        budget: mission.budget,
        successCriteria: mission.successCriteria,
        constraints: mission.constraints,
        unknowns: mission.unknowns,
        assumptions: mission.assumptions,
        stopConditions: mission.stopConditions,
        createdAt: new Date(mission.createdAt),
        startedAt: mission.startedAt ? new Date(mission.startedAt) : null,
        completedAt: mission.completedAt ? new Date(mission.completedAt) : null,
        version: mission.version,
      });
    },
    async getById(id) {
      const rows = await executor.select().from(missions).where(eq(missions.id, id)).limit(1);
      return rows[0] ? toDomain(rows[0]) : null;
    },
    async list(ownerId) {
      const rows = await executor
        .select()
        .from(missions)
        .where(eq(missions.ownerId, ownerId))
        .orderBy(desc(missions.createdAt));
      return rows.map(toDomain);
    },
  };
}
