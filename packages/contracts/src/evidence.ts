import { evidenceSchema, type Evidence } from "@pios/domain";
import { z } from "zod";

export const evidenceDtoSchema = evidenceSchema;
export type EvidenceDto = Evidence;

export const captureOwnerEvidenceRequestSchema = z.object({
  sourceUrl: z.string().url().max(2_000),
  title: z.string().trim().min(1).max(500),
  excerpt: z.string().trim().min(1).max(8_000),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type CaptureOwnerEvidenceRequest = z.infer<typeof captureOwnerEvidenceRequestSchema>;

export const captureOwnerEvidenceResponseSchema = z.object({
  evidence: evidenceDtoSchema,
});
export type CaptureOwnerEvidenceResponse = z.infer<typeof captureOwnerEvidenceResponseSchema>;

export const listEvidenceResponseSchema = z.object({
  evidence: z.array(evidenceDtoSchema),
});
export type ListEvidenceResponse = z.infer<typeof listEvidenceResponseSchema>;
