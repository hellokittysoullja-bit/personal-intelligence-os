import {
  createMissionCreatedEvent,
  DEFAULT_MISSION_BUDGET,
  newId,
  type DomainEvent,
  type Goal,
  type Mission,
  type UnitOfWork,
} from "@pios/domain";

const TITLE_MAX_LENGTH = 80;

function deriveTitle(rawRequest: string): string {
  const trimmed = rawRequest.trim();
  return trimmed.length > TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : trimmed;
}

export interface CreateMissionInput {
  ownerId: string;
  rawRequest: string;
}

export interface CreateMissionResult {
  mission: Mission;
  event: DomainEvent;
}

/**
 * docs/DOMAIN_MODEL.md §1-3. В Milestone 2 миссия создаётся без реальной
 * интерпретации (UNDERSTAND/CONTRACT — Milestone 3-4): Goal и Mission
 * заводятся напрямую из буквального запроса, currentPhase остаётся
 * "intake", MissionContract не строится.
 */
export function createCreateMission(unitOfWork: UnitOfWork) {
  return async function createMission(input: CreateMissionInput): Promise<CreateMissionResult> {
    const now = new Date().toISOString();
    const title = deriveTitle(input.rawRequest);

    const goal: Goal = {
      id: newId(),
      ownerId: input.ownerId,
      rawRequest: input.rawRequest,
      inferredIntent: null,
      desiredOutcome: null,
      parentGoalId: null,
      priority: "normal",
      status: "converted_to_mission",
      createdAt: now,
      updatedAt: now,
    };

    const mission: Mission = {
      id: newId(),
      ownerId: input.ownerId,
      goalId: goal.id,
      title,
      objective: input.rawRequest,
      status: "created",
      currentPhase: "intake",
      autonomyLevel: "supervised",
      riskLevel: "L1",
      budget: DEFAULT_MISSION_BUDGET,
      successCriteria: [],
      constraints: [],
      unknowns: [],
      assumptions: [],
      stopConditions: [],
      createdAt: now,
      startedAt: null,
      completedAt: null,
      version: 1,
    };

    const event = createMissionCreatedEvent({
      ownerId: input.ownerId,
      missionId: mission.id,
      goalId: goal.id,
      title: mission.title,
      objective: mission.objective,
    });

    return unitOfWork.run(async (ctx) => {
      await ctx.goals.create(goal);
      await ctx.missions.create(mission);
      await ctx.events.append(event);
      return { mission, event };
    });
  };
}

export type CreateMission = ReturnType<typeof createCreateMission>;
