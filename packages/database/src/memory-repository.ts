import type { MemoryRecord, MemoryRepository } from "@pios/domain";
import { and, asc, eq, gt, isNull, ne, or } from "drizzle-orm";
import type { Executor } from "./client";
import { memoryRecords } from "./schema";

function toDomain(row: typeof memoryRecords.$inferSelect): MemoryRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    memoryType: row.memoryType as MemoryRecord["memoryType"],
    scope: row.scope as MemoryRecord["scope"],
    subject: row.subject,
    content: row.content,
    structuredData: row.structuredData,
    provenance: row.provenance,
    confidence: row.confidence / 10_000,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    status: row.status as MemoryRecord["status"],
    supersedesId: row.supersedesId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toValues(memory: MemoryRecord) {
  return {
    ownerId: memory.ownerId,
    memoryType: memory.memoryType,
    scope: memory.scope,
    subject: memory.subject,
    content: memory.content,
    structuredData: memory.structuredData,
    provenance: memory.provenance,
    confidence: Math.round(memory.confidence * 10_000),
    validFrom: memory.validFrom ? new Date(memory.validFrom) : null,
    validUntil: memory.validUntil ? new Date(memory.validUntil) : null,
    status: memory.status,
    supersedesId: memory.supersedesId,
    version: memory.version,
    updatedAt: new Date(memory.updatedAt),
  };
}

export function createMemoryRepository(executor: Executor): MemoryRepository {
  return {
    async create(memory) {
      await executor.insert(memoryRecords).values({
        id: memory.id,
        ...toValues(memory),
        createdAt: new Date(memory.createdAt),
      });
    },
    async getById(memoryId) {
      const rows = await executor.select().from(memoryRecords).where(eq(memoryRecords.id, memoryId));
      const row = rows[0];
      return row ? toDomain(row) : null;
    },
    async update(memory, expectedVersion) {
      const updated = await executor
        .update(memoryRecords)
        .set(toValues(memory))
        .where(and(eq(memoryRecords.id, memory.id), eq(memoryRecords.version, expectedVersion)))
        .returning({ id: memoryRecords.id });
      return updated.length === 1;
    },
    async listByOwner(ownerId, options) {
      const where = options?.includeForgotten
        ? eq(memoryRecords.ownerId, ownerId)
        : and(eq(memoryRecords.ownerId, ownerId), ne(memoryRecords.status, "forgotten"));
      const rows = await executor
        .select()
        .from(memoryRecords)
        .where(where)
        .orderBy(asc(memoryRecords.subject), asc(memoryRecords.createdAt));
      return rows.map(toDomain);
    },
    async listActiveByScopeAndSubject(ownerId, scope, subject) {
      const now = new Date();
      const rows = await executor
        .select()
        .from(memoryRecords)
        .where(and(
          eq(memoryRecords.ownerId, ownerId),
          eq(memoryRecords.scope, scope),
          eq(memoryRecords.subject, subject),
          eq(memoryRecords.status, "active"),
          or(isNull(memoryRecords.validUntil), gt(memoryRecords.validUntil, now)),
        ))
        .orderBy(asc(memoryRecords.createdAt));
      return rows.map(toDomain);
    },
  };
}
