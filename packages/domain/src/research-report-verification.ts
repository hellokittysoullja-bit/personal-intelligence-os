import { z } from "zod";

export const claimVerificationVerdictSchema = z.enum(["supported", "contradicted", "inconclusive"]);
export type ClaimVerificationVerdict = z.infer<typeof claimVerificationVerdictSchema>;

export const researchReportVerificationFindingSchema = z.object({
  claimIndex: z.number().int().nonnegative(),
  verdict: claimVerificationVerdictSchema,
  rationale: z.string().trim().min(1).max(2_000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(20),
});

export const researchReportVerificationContentSchema = z.object({
  findings: z.array(researchReportVerificationFindingSchema).min(1).max(30),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(20),
});
export type ResearchReportVerificationContent = z.infer<typeof researchReportVerificationContentSchema>;

export const researchReportVerificationSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid(),
  reportId: z.string().uuid(),
  verdict: z.enum(["passed", "needs_review"]),
  content: researchReportVerificationContentSchema,
  model: z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    requestId: z.string().uuid(),
    promptVersion: z.literal("research_report_verification_v1"),
    repairAttempted: z.boolean(),
    promptTokens: z.number().int().nonnegative().nullable(),
    completionTokens: z.number().int().nonnegative().nullable(),
    totalTokens: z.number().int().nonnegative().nullable(),
    estimatedCostUsd: z.number().nonnegative().nullable(),
  }),
  createdAt: z.string().datetime(),
});
export type ResearchReportVerification = z.infer<typeof researchReportVerificationSchema>;
