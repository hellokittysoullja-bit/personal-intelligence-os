import { randomUUID } from "node:crypto";
import type { Evidence } from "./evidence";
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


export interface MissionResearchPlannedPayload {
  missionId: string;
  version: number;
  taskIds: string[];
  mode: "read_only";
}

export interface ResearchEvidenceCapturedPayload {
  evidenceId: string;
  sourceUrl: string;
  contentHash: string;
  collector: Evidence["provenance"]["collector"];
}

export function createResearchEvidenceCapturedEvent(evidence: Evidence, traceId?: string): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType: "ResearchEvidenceCaptured",
    timestamp: new Date().toISOString(),
    ownerId: evidence.ownerId,
    missionId: evidence.missionId,
    taskId: null,
    agentJobId: null,
    traceId: traceId ?? randomUUID(),
    causationId: null,
    correlationId: evidence.missionId,
    payload: {
      evidenceId: evidence.id,
      sourceUrl: evidence.sourceUrl,
      contentHash: evidence.contentHash,
      collector: evidence.provenance.collector,
    } satisfies ResearchEvidenceCapturedPayload,
    schemaVersion: 1,
  };
}

export function createMissionResearchPlannedEvent(
  mission: Mission,
  taskIds: string[],
  traceId?: string,
): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType: "MissionResearchPlanned",
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
      taskIds,
      mode: "read_only",
    } satisfies MissionResearchPlannedPayload,
    schemaVersion: 1,
  };
}


export interface ResearchReportDraftedPayload {
  reportId: string;
  citedEvidenceIds: string[];
  providerId: string;
  model: string;
  requestId: string;
  repairAttempted: boolean;
}

export function createResearchReportDraftedEvent(params: {
  ownerId: string;
  missionId: string;
  reportId: string;
  citedEvidenceIds: string[];
  providerId: string;
  model: string;
  requestId: string;
  repairAttempted: boolean;
  traceId?: string;
}): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType: "ResearchReportDrafted",
    timestamp: new Date().toISOString(),
    ownerId: params.ownerId,
    missionId: params.missionId,
    taskId: null,
    agentJobId: null,
    traceId: params.traceId ?? randomUUID(),
    causationId: null,
    correlationId: params.missionId,
    payload: {
      reportId: params.reportId,
      citedEvidenceIds: params.citedEvidenceIds,
      providerId: params.providerId,
      model: params.model,
      requestId: params.requestId,
      repairAttempted: params.repairAttempted,
    } satisfies ResearchReportDraftedPayload,
    schemaVersion: 1,
  };
}


export interface ResearchReportVerifiedPayload {
  reportId: string;
  verificationId: string;
  verdict: "passed" | "needs_review";
  providerId: string;
  model: string;
  requestId: string;
  repairAttempted: boolean;
}

export function createResearchReportVerifiedEvent(params: {
  ownerId: string;
  missionId: string;
  reportId: string;
  verificationId: string;
  verdict: "passed" | "needs_review";
  providerId: string;
  model: string;
  requestId: string;
  repairAttempted: boolean;
  traceId?: string;
}): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType: "ResearchReportVerified",
    timestamp: new Date().toISOString(),
    ownerId: params.ownerId,
    missionId: params.missionId,
    taskId: null,
    agentJobId: null,
    traceId: params.traceId ?? randomUUID(),
    causationId: null,
    correlationId: params.missionId,
    payload: {
      reportId: params.reportId,
      verificationId: params.verificationId,
      verdict: params.verdict,
      providerId: params.providerId,
      model: params.model,
      requestId: params.requestId,
      repairAttempted: params.repairAttempted,
    } satisfies ResearchReportVerifiedPayload,
    schemaVersion: 1,
  };
}


export interface MemoryLifecyclePayload {
  memoryId: string;
  memoryType: string;
  scope: string;
  subject: string;
  status: string;
  supersedesId: string | null;
}

function createMemoryLifecycleEvent(
  eventType: "MemoryCandidateCreated" | "MemoryApproved" | "MemoryActivated" | "MemorySuperseded" | "MemoryForgotten",
  memory: { id: string; ownerId: string; memoryType: string; scope: string; subject: string; status: string; supersedesId: string | null },
  traceId?: string,
): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    ownerId: memory.ownerId,
    missionId: null,
    taskId: null,
    agentJobId: null,
    traceId: traceId ?? randomUUID(),
    causationId: null,
    correlationId: memory.id,
    payload: {
      memoryId: memory.id,
      memoryType: memory.memoryType,
      scope: memory.scope,
      subject: memory.subject,
      status: memory.status,
      supersedesId: memory.supersedesId,
    } satisfies MemoryLifecyclePayload,
    schemaVersion: 1,
  };
}

export function createMemoryCandidateCreatedEvent(memory: Parameters<typeof createMemoryLifecycleEvent>[1], traceId?: string): DomainEvent {
  return createMemoryLifecycleEvent("MemoryCandidateCreated", memory, traceId);
}

export function createMemoryApprovedEvent(memory: Parameters<typeof createMemoryLifecycleEvent>[1], traceId?: string): DomainEvent {
  return createMemoryLifecycleEvent("MemoryApproved", memory, traceId);
}

export function createMemoryActivatedEvent(memory: Parameters<typeof createMemoryLifecycleEvent>[1], traceId?: string): DomainEvent {
  return createMemoryLifecycleEvent("MemoryActivated", memory, traceId);
}

export function createMemorySupersededEvent(memory: Parameters<typeof createMemoryLifecycleEvent>[1], traceId?: string): DomainEvent {
  return createMemoryLifecycleEvent("MemorySuperseded", memory, traceId);
}

export function createMemoryForgottenEvent(memory: Parameters<typeof createMemoryLifecycleEvent>[1], traceId?: string): DomainEvent {
  return createMemoryLifecycleEvent("MemoryForgotten", memory, traceId);
}

export interface BrowserProfileLifecyclePayload {
  profileId: string;
  mode: string;
  status: string;
  version: number;
}

function createBrowserProfileLifecycleEvent(
  eventType: "BrowserProfileCreated" | "BrowserProfileDisabled",
  profile: { id: string; ownerId: string; mode: string; status: string; version: number },
  traceId?: string,
): DomainEvent {
  return {
    eventId: randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    ownerId: profile.ownerId,
    missionId: null,
    taskId: null,
    agentJobId: null,
    traceId: traceId ?? randomUUID(),
    causationId: null,
    correlationId: profile.id,
    payload: {
      profileId: profile.id,
      mode: profile.mode,
      status: profile.status,
      version: profile.version,
    } satisfies BrowserProfileLifecyclePayload,
    schemaVersion: 1,
  };
}

export function createBrowserProfileCreatedEvent(
  profile: Parameters<typeof createBrowserProfileLifecycleEvent>[1],
  traceId?: string,
): DomainEvent {
  return createBrowserProfileLifecycleEvent("BrowserProfileCreated", profile, traceId);
}

export function createBrowserProfileDisabledEvent(
  profile: Parameters<typeof createBrowserProfileLifecycleEvent>[1],
  traceId?: string,
): DomainEvent {
  return createBrowserProfileLifecycleEvent("BrowserProfileDisabled", profile, traceId);
}
