import { approvalRequestSchema } from "@pios/domain";
import { z } from "zod";

export const approvalDtoSchema = approvalRequestSchema;
export type ApprovalDto = z.infer<typeof approvalDtoSchema>;

export const decideApprovalRequestSchema = z.object({ decision: z.enum(["approved", "rejected"]) }).strict();
export type DecideApprovalRequest = z.infer<typeof decideApprovalRequestSchema>;
export const approvalResponseSchema = z.object({ approval: approvalDtoSchema });
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;
export const listApprovalsResponseSchema = z.object({ approvals: z.array(approvalDtoSchema) });
export type ListApprovalsResponse = z.infer<typeof listApprovalsResponseSchema>;
