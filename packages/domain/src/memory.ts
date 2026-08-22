import { z } from "zod";

export const memoryTypeSchema = z.enum([
  "owner_preference",
  "project_fact",
  "world_fact",
  "decision",
  "episode",
  "failure",
  "lesson",
  "procedure",
  "relationship",
  "temporary_context",
]);
export type MemoryType = z.infer<typeof memoryTypeSchema>;

export const memoryScopeSchema = z.enum(["owner", "project", "mission", "global"]);
export type MemoryScope = z.infer<typeof memoryScopeSchema>;

export const memoryStatusSchema = z.enum([
  "candidate",
  "approved",
  "active",
  "superseded",
  "expired",
  "forgotten",
  "rejected",
]);
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;

export const memoryProvenanceSchema = z.object({
  sourceMissionId: z.string().uuid().nullable(),
  sourceReportId: z.string().uuid().nullable(),
  sourceEvidenceIds: z.array(z.string().uuid()).max(50),
  submittedBy: z.literal("owner"),
});
export type MemoryProvenance = z.infer<typeof memoryProvenanceSchema>;

export const memoryRecordSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  memoryType: memoryTypeSchema,
  scope: memoryScopeSchema,
  subject: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(8_000),
  structuredData: z.record(z.string(), z.unknown()).default({}),
  provenance: memoryProvenanceSchema,
  confidence: z.number().min(0).max(1),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  status: memoryStatusSchema,
  supersedesId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

export function transitionMemoryStatus(
  memory: MemoryRecord,
  status: MemoryStatus,
  now = new Date().toISOString(),
): MemoryRecord {
  const allowed: Record<MemoryStatus, MemoryStatus[]> = {
    candidate: ["approved", "rejected"],
    approved: ["active", "rejected", "forgotten"],
    active: ["superseded", "expired", "forgotten"],
    superseded: ["forgotten"],
    expired: ["forgotten"],
    forgotten: [],
    rejected: ["forgotten"],
  };
  if (!allowed[memory.status].includes(status)) {
    throw new Error(`Invalid memory status transition: ${memory.status} -> ${status}`);
  }
  return { ...memory, status, version: memory.version + 1, updatedAt: now };
}
