import { z } from "zod";

const citationIdsSchema = z.array(z.string().uuid()).min(1).max(20);

export const researchReportClaimSchema = z.object({
  statement: z.string().trim().min(1).max(2_000),
  evidenceIds: citationIdsSchema,
  confidence: z.number().min(0).max(1),
});

export const researchReportContentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.object({
    text: z.string().trim().min(1).max(6_000),
    evidenceIds: citationIdsSchema,
  }),
  claims: z.array(researchReportClaimSchema).min(1).max(30),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(20),
});
export type ResearchReportContent = z.infer<typeof researchReportContentSchema>;

export const researchReportSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid(),
  status: z.literal("draft"),
  content: researchReportContentSchema,
  citedEvidenceIds: z.array(z.string().uuid()).min(1).max(200),
  model: z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    requestId: z.string().uuid(),
    promptVersion: z.literal("research_report_v1"),
    repairAttempted: z.boolean(),
    promptTokens: z.number().int().nonnegative().nullable(),
    completionTokens: z.number().int().nonnegative().nullable(),
    totalTokens: z.number().int().nonnegative().nullable(),
    estimatedCostUsd: z.number().nonnegative().nullable(),
  }),
  createdAt: z.string().datetime(),
});
export type ResearchReport = z.infer<typeof researchReportSchema>;
