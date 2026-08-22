import { randomUUID } from "node:crypto";
import type { Mission } from "./mission";
import { z } from "zod";

/**
 * docs/DOMAIN_MODEL.md §12. eventType намеренно типизирован как string, а
 * не как замкнутый union всех ~30 типов событий из ТЗ — в Milestone 2
 * производится только "MissionCreated". Полный канонический список типов
 * вводится по мере того, как соответствующий use case начинает его
 * порождать (не раньше), см. правило "не создавать абстракцию без
 * текущего применения" (docs/DEVELOPMENT.md §3.3).
 */
export const domainEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  timestamp: z.string().datetime(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid().nullable(),
  taskId: z.string().uuid().nullable(),
  agentJobId: z.string().uuid().nullable(),
  traceId: z.string().min(1),
  causationId: z.string().uuid().nullable(),
  correlationId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().positive(),
});
export type DomainEvent = z.infer<typeof domainEventSchema>;

export interface MissionCreatedPayload {
  missionId: string;
  goalId: string;
  title: string;
  objective: string;
}

/** Единственный тип события, реально производимый в Milestone 2 (CreateMission). */
export interface MissionContractPayload {
  missionId: string;
  version: number;
  objective: string;
  autonomyLevel: Mission["autonomyLevel"];
  riskLevel: Mission["riskLevel"];
  budget: Mission["budget"];
  successCriteria: string[];
  constraints: string[];
  unknowns: string[];
  assumptions: string[];
  stopConditions: string[];
}

function createMissionContractEvent(
  eventType: "MissionContractUpdated" | "MissionContractConfirmed",
  mission: Mission,
  traceId?: string,
): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    ownerId: mission.ownerId,
    missionId: mission.id,
    taskId: null,
    agentJobId: null,
    traceId: traceId ?? randomUUID(),
    causationId: null,
    correlationId: mission.id,
    payload: {
      missionId: mission.id,
      version: mission.version,
      objective: mission.objective,
      autonomyLevel: mission.autonomyLevel,
      riskLevel: mission.riskLevel,
      budget: mission.budget,
      successCriteria: mission.successCriteria,
      constraints: mission.constraints,
      unknowns: mission.unknowns,
      assumptions: mission.assumptions,
      stopConditions: mission.stopConditions,
    } satisfies MissionContractPayload,
    schemaVersion: 1,
  };
}

export function createMissionContractUpdatedEvent(mission: Mission, traceId?: string): DomainEvent {
  return createMissionContractEvent("MissionContractUpdated", mission, traceId);
}

export function createMissionContractConfirmedEvent(mission: Mission, traceId?: string): DomainEvent {
  return createMissionContractEvent("MissionContractConfirmed", mission, traceId);
}

export function createMissionCreatedEvent(params: {
  ownerId: string;
  missionId: string;
  goalId: string;
  title: string;
  objective: string;
  traceId?: string;
}): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType: "MissionCreated",
    timestamp: new Date().toISOString(),
    ownerId: params.ownerId,
    missionId: params.missionId,
    taskId: null,
    agentJobId: null,
    traceId: params.traceId ?? randomUUID(),
    causationId: null,
    correlationId: params.missionId,
    payload: {
      missionId: params.missionId,
      goalId: params.goalId,
      title: params.title,
      objective: params.objective,
    } satisfies MissionCreatedPayload,
    schemaVersion: 1,
  };
}
