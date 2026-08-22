import {
  createMemoryActivatedEvent,
  createMemoryApprovedEvent,
  createMemoryCandidateCreatedEvent,
  createMemoryForgottenEvent,
  createMemorySupersededEvent,
  DomainError,
  newId,
  transitionMemoryStatus,
  type MemoryProvenance,
  type MemoryRecord,
  type MemoryScope,
  type MemoryType,
  type UnitOfWork,
} from "@pios/domain";

export interface CreateMemoryCandidateInput {
  ownerId: string;
  memoryType: MemoryType;
  scope: MemoryScope;
  subject: string;
  content: string;
  structuredData?: Record<string, unknown>;
  provenance?: Partial<Omit<MemoryProvenance, "submittedBy">>;
  confidence: number;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface MemoryTransitionInput {
  memoryId: string;
  ownerId: string;
  expectedVersion: number;
}

function assertOwnedMemory(memory: MemoryRecord | null, ownerId: string): asserts memory is MemoryRecord {
  if (!memory || memory.ownerId !== ownerId) {
    throw new DomainError("MEMORY_NOT_FOUND", "Memory record not found");
  }
}

function requireStatus(memory: MemoryRecord, status: MemoryRecord["status"]) {
  if (memory.status !== status) {
    throw new DomainError("MEMORY_INVALID_STATUS", `Memory must be ${status}, but is ${memory.status}`);
  }
}

async function updateOrConflict(
  ctx: Parameters<UnitOfWork["run"]>[0] extends (ctx: infer Context) => Promise<unknown> ? Context : never,
  memory: MemoryRecord,
  expectedVersion: number,
): Promise<void> {
  if (!await ctx.memories.update(memory, expectedVersion)) {
    throw new DomainError("MEMORY_VERSION_CONFLICT", "Memory changed concurrently; reload before retrying");
  }
}

export function createCreateMemoryCandidate(unitOfWork: UnitOfWork) {
  return async function createMemoryCandidate(input: CreateMemoryCandidateInput) {
    return unitOfWork.run(async (ctx) => {
      const now = new Date().toISOString();
      const memory: MemoryRecord = {
        id: newId(),
        ownerId: input.ownerId,
        memoryType: input.memoryType,
        scope: input.scope,
        subject: input.subject.trim(),
        content: input.content.trim(),
        structuredData: input.structuredData ?? {},
        provenance: {
          sourceMissionId: input.provenance?.sourceMissionId ?? null,
          sourceReportId: input.provenance?.sourceReportId ?? null,
          sourceEvidenceIds: input.provenance?.sourceEvidenceIds ?? [],
          submittedBy: "owner",
        },
        confidence: input.confidence,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        status: "candidate",
        supersedesId: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await ctx.memories.create(memory);
      const event = createMemoryCandidateCreatedEvent(memory);
      await ctx.events.append(event);
      return { memory, event };
    });
  };
}

export function createApproveMemory(unitOfWork: UnitOfWork) {
  return async function approveMemory(input: MemoryTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.memories.getById(input.memoryId);
      assertOwnedMemory(current, input.ownerId);
      requireStatus(current, "candidate");
      if (current.version !== input.expectedVersion) {
        throw new DomainError("MEMORY_VERSION_CONFLICT", "Memory changed concurrently; reload before retrying");
      }
      const memory = transitionMemoryStatus(current, "approved");
      await updateOrConflict(ctx, memory, input.expectedVersion);
      const event = createMemoryApprovedEvent(memory);
      await ctx.events.append(event);
      return { memory, event };
    });
  };
}

export function createActivateMemory(unitOfWork: UnitOfWork) {
  return async function activateMemory(input: MemoryTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.memories.getById(input.memoryId);
      assertOwnedMemory(current, input.ownerId);
      requireStatus(current, "approved");
      if (current.version !== input.expectedVersion) {
        throw new DomainError("MEMORY_VERSION_CONFLICT", "Memory changed concurrently; reload before retrying");
      }
      const active = await ctx.memories.listActiveByScopeAndSubject(current.ownerId, current.scope, current.subject);
      if (active.length > 1) {
        throw new DomainError("MEMORY_INTEGRITY_ERROR", "Multiple active memories exist for this scope and subject");
      }
      const previous = active[0];
      if (previous) {
        const superseded = transitionMemoryStatus(previous, "superseded");
        await updateOrConflict(ctx, superseded, previous.version);
        await ctx.events.append(createMemorySupersededEvent(superseded));
      }
      const memory = {
        ...transitionMemoryStatus(current, "active"),
        supersedesId: previous?.id ?? null,
      };
      await updateOrConflict(ctx, memory, input.expectedVersion);
      const event = createMemoryActivatedEvent(memory);
      await ctx.events.append(event);
      return { memory, previous, event };
    });
  };
}

export function createForgetMemory(unitOfWork: UnitOfWork) {
  return async function forgetMemory(input: MemoryTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.memories.getById(input.memoryId);
      assertOwnedMemory(current, input.ownerId);
      if (current.version !== input.expectedVersion) {
        throw new DomainError("MEMORY_VERSION_CONFLICT", "Memory changed concurrently; reload before retrying");
      }
      if (current.status === "forgotten") {
        throw new DomainError("MEMORY_INVALID_STATUS", "Memory is already forgotten");
      }
      const memory = transitionMemoryStatus(current, "forgotten");
      await updateOrConflict(ctx, memory, input.expectedVersion);
      const event = createMemoryForgottenEvent(memory);
      await ctx.events.append(event);
      return { memory, event };
    });
  };
}

export type CreateMemoryCandidate = ReturnType<typeof createCreateMemoryCandidate>;
export type ApproveMemory = ReturnType<typeof createApproveMemory>;
export type ActivateMemory = ReturnType<typeof createActivateMemory>;
export type ForgetMemory = ReturnType<typeof createForgetMemory>;
