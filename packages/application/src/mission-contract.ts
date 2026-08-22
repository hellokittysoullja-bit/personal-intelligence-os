import {
  assertMissionTransition,
  createMissionContractConfirmedEvent,
  createMissionContractUpdatedEvent,
  DomainError,
  type AutonomyLevel,
  type Mission,
  type MissionBudget,
  type ActionRiskLevel,
  type UnitOfWork,
} from "@pios/domain";

export interface UpdateMissionContractInput {
  missionId: string;
  ownerId: string;
  expectedVersion: number;
  objective: string;
  autonomyLevel: AutonomyLevel;
  riskLevel: ActionRiskLevel;
  budget: MissionBudget;
  successCriteria: string[];
  constraints: string[];
  unknowns: string[];
  assumptions: string[];
  stopConditions: string[];
}

export interface ConfirmMissionContractInput {
  missionId: string;
  ownerId: string;
  expectedVersion: number;
}

function assertEditableContract(mission: Mission, ownerId: string): void {
  if (mission.ownerId !== ownerId) {
    throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
  }
  if (mission.status !== "created" || !["intake", "contract"].includes(mission.currentPhase)) {
    throw new DomainError("MISSION_NOT_EDITABLE", "Mission contract can no longer be edited");
  }
}

function assertVersion(mission: Mission, expectedVersion: number): void {
  if (mission.version !== expectedVersion) {
    throw new DomainError("MISSION_VERSION_CONFLICT", "Mission was changed by another request");
  }
}

export function createUpdateMissionContract(unitOfWork: UnitOfWork) {
  return async function updateMissionContract(input: UpdateMissionContractInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.missions.getById(input.missionId);
      if (!current) throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
      assertEditableContract(current, input.ownerId);
      assertVersion(current, input.expectedVersion);

      const mission: Mission = {
        ...current,
        objective: input.objective,
        autonomyLevel: input.autonomyLevel,
        riskLevel: input.riskLevel,
        budget: input.budget,
        successCriteria: input.successCriteria,
        constraints: input.constraints,
        unknowns: input.unknowns,
        assumptions: input.assumptions,
        stopConditions: input.stopConditions,
        currentPhase: "contract",
        version: current.version + 1,
      };
      const updated = await ctx.missions.update(mission, input.expectedVersion);
      if (!updated) {
        throw new DomainError("MISSION_VERSION_CONFLICT", "Mission was changed by another request");
      }

      const event = createMissionContractUpdatedEvent(mission);
      await ctx.events.append(event);
      return { mission, event };
    });
  };
}

export function createConfirmMissionContract(unitOfWork: UnitOfWork) {
  return async function confirmMissionContract(input: ConfirmMissionContractInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.missions.getById(input.missionId);
      if (!current) throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
      assertEditableContract(current, input.ownerId);
      assertVersion(current, input.expectedVersion);
      if (current.currentPhase !== "contract") {
        throw new DomainError("MISSION_CONTRACT_NOT_READY", "Update the mission contract before confirming it");
      }
      if (current.successCriteria.length === 0) {
        throw new DomainError("MISSION_CONTRACT_INCOMPLETE", "Add at least one success criterion");
      }

      assertMissionTransition(current.status, "understanding");
      const mission: Mission = {
        ...current,
        status: "understanding",
        currentPhase: "understand",
        version: current.version + 1,
      };
      const updated = await ctx.missions.update(mission, input.expectedVersion);
      if (!updated) {
        throw new DomainError("MISSION_VERSION_CONFLICT", "Mission was changed by another request");
      }

      const event = createMissionContractConfirmedEvent(mission);
      await ctx.events.append(event);
      return { mission, event };
    });
  };
}

export type UpdateMissionContract = ReturnType<typeof createUpdateMissionContract>;
export type ConfirmMissionContract = ReturnType<typeof createConfirmMissionContract>;
