import {
  assertMissionTransition,
  createMissionResearchPlannedEvent,
  DomainError,
  newId,
  type Mission,
  type Task,
  type UnitOfWork,
} from "@pios/domain";

export interface PlanResearchMissionInput {
  missionId: string;
  ownerId: string;
  expectedVersion: number;
}

function buildTask(mission: Mission, input: {
  id: string;
  title: string;
  description: string;
  status: Task["status"];
  dependencies?: string[];
  evidenceRequirements: string[];
}): Task {
  const now = new Date().toISOString();
  return {
    id: input.id,
    missionId: mission.id,
    parentTaskId: null,
    title: input.title,
    description: input.description,
    taskType: "research",
    status: input.status,
    dependencies: input.dependencies ?? [],
    assignedAgentJobId: null,
    inputArtifactIds: [],
    outputArtifactIds: [],
    successCriteria: [],
    evidenceRequirements: input.evidenceRequirements,
    maxAttempts: 1,
    attemptCount: 0,
    timeoutMs: Math.min(mission.budget.maxDurationMs, 10 * 60 * 1000),
    budget: mission.budget,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function createPlanResearchMission(unitOfWork: UnitOfWork) {
  return async function planResearchMission(input: PlanResearchMissionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.missions.getById(input.missionId);
      if (!current || current.ownerId !== input.ownerId) {
        throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
      }
      if (current.status !== "understanding" || current.currentPhase !== "understand") {
        throw new DomainError("MISSION_NOT_READY_FOR_RESEARCH", "Confirm the mission contract first");
      }
      if (current.version !== input.expectedVersion) {
        throw new DomainError("MISSION_VERSION_CONFLICT", "Mission was changed by another request");
      }

      assertMissionTransition(current.status, "planning");
      const mission: Mission = {
        ...current,
        status: "planning",
        currentPhase: "plan",
        version: current.version + 1,
      };
      const sourceTaskId = newId();
      const synthesisTaskId = newId();
      const verificationTaskId = newId();
      const tasks = [
        buildTask(mission, {
          id: sourceTaskId,
          title: "Собрать источники",
          description: "Найти и сохранить только публичные read-only источники по цели миссии.",
          status: "ready",
          evidenceRequirements: ["URL", "время получения", "фрагмент источника"],
        }),
        buildTask(mission, {
          id: synthesisTaskId,
          title: "Собрать исследовательский отчёт",
          description: "Синтезировать выводы только из сохранённых evidence.",
          status: "pending",
          dependencies: [sourceTaskId],
          evidenceRequirements: ["ссылки на evidence"],
        }),
        buildTask(mission, {
          id: verificationTaskId,
          title: "Проверить отчёт",
          description: "Проверить, что выводы имеют evidence и не содержат внешних действий.",
          status: "pending",
          dependencies: [synthesisTaskId],
          evidenceRequirements: ["список проверенных утверждений"],
        }),
      ];

      const updated = await ctx.missions.update(mission, input.expectedVersion);
      if (!updated) throw new DomainError("MISSION_VERSION_CONFLICT", "Mission was changed by another request");
      for (const task of tasks) await ctx.tasks.create(task);
      const event = createMissionResearchPlannedEvent(mission, tasks.map((task) => task.id));
      await ctx.events.append(event);
      return { mission, tasks, event };
    });
  };
}

export type PlanResearchMission = ReturnType<typeof createPlanResearchMission>;
