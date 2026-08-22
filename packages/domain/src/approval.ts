import { z } from "zod";

export const approvalRiskLevelSchema = z.enum(["L3", "L4"]);
export type ApprovalRiskLevel = z.infer<typeof approvalRiskLevelSchema>;
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "expired", "consumed"]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalRequestSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid().nullable(),
  channel: z.enum(["telegram", "browser", "external_api"]),
  actionKind: z.string().trim().min(1).max(120),
  riskLevel: approvalRiskLevelSchema,
  preview: z.string().trim().min(1).max(4_000),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: approvalStatusSchema,
  expiresAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
  consumedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export function decideApproval(request: ApprovalRequest, decision: "approved" | "rejected", now = new Date().toISOString()): ApprovalRequest {
  if (request.status !== "pending") throw new Error(`Approval is not pending: ${request.status}`);
  if (request.expiresAt <= now) return { ...request, status: "expired", decidedAt: now };
  return { ...request, status: decision, decidedAt: now };
}

export function consumeApproval(request: ApprovalRequest, payloadHash: string, now = new Date().toISOString()): ApprovalRequest {
  if (request.status !== "approved") throw new Error(`Approval is not approved: ${request.status}`);
  if (request.expiresAt <= now) return { ...request, status: "expired", decidedAt: request.decidedAt };
  if (request.payloadHash !== payloadHash) throw new Error("Approval payload hash mismatch");
  return { ...request, status: "consumed", consumedAt: now };
}
