import {
  memoryRecordSchema,
  memoryScopeSchema,
  memoryTypeSchema,
} from "@pios/domain";
import type { MemoryScope, MemoryType } from "@pios/domain";
import { z } from "zod";

export const memoryDtoSchema = memoryRecordSchema;
export type MemoryDto = z.infer<typeof memoryDtoSchema>;
export type { MemoryScope, MemoryType };

export const createMemoryCandidateRequestSchema = z.object({
  memoryType: memoryTypeSchema,
  scope: memoryScopeSchema,
  subject: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(8_000),
  structuredData: z.record(z.string(), z.unknown()).optional(),
  provenance: z.object({
    sourceMissionId: z.string().uuid().nullable().optional(),
    sourceReportId: z.string().uuid().nullable().optional(),
    sourceEvidenceIds: z.array(z.string().uuid()).max(50).optional(),
  }).optional(),
  confidence: z.number().min(0).max(1),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
}).strict();
export type CreateMemoryCandidateRequest = z.infer<typeof createMemoryCandidateRequestSchema>;

export const memoryTransitionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
export type MemoryTransitionRequest = z.infer<typeof memoryTransitionRequestSchema>;

export const memoryResponseSchema = z.object({ memory: memoryDtoSchema });
export type MemoryResponse = z.infer<typeof memoryResponseSchema>;

export const listMemoriesResponseSchema = z.object({ memories: z.array(memoryDtoSchema) });
export type ListMemoriesResponse = z.infer<typeof listMemoriesResponseSchema>;
