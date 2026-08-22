import { actionRiskLevelSchema, type ActionRiskLevel } from "@pios/domain";
import { z } from "zod";

export const toolChannelSchema = z.enum(["local", "browser", "telegram", "external_api"]);
export type ToolChannel = z.infer<typeof toolChannelSchema>;

export const toolPolicyInputSchema = z.object({
  toolName: z.string().trim().min(1).max(120),
  actionKind: z.string().trim().min(1).max(120),
  channel: toolChannelSchema,
  riskLevel: actionRiskLevelSchema,
}).strict();
export type ToolPolicyInput = z.infer<typeof toolPolicyInputSchema>;

export const toolPolicyDecisionSchema = z.enum(["auto", "require_approval", "deny"]);
export type ToolPolicyDecision = z.infer<typeof toolPolicyDecisionSchema>;

export interface PolicyEngine {
  decide(input: ToolPolicyInput): { decision: ToolPolicyDecision; reason: string };
}

/**
 * The baseline is intentionally conservative. It is not a per-project
 * permission system: L2 is denied until a configured policy exists, and only
 * external approval channels may reach the approval flow. This gives future
 * browser tools a fail-closed default rather than an implicit allow path.
 */
export class ConservativePolicyEngine implements PolicyEngine {
  decide(input: ToolPolicyInput): { decision: ToolPolicyDecision; reason: string } {
    const parsed = toolPolicyInputSchema.parse(input);
    if (parsed.riskLevel === "L0" || parsed.riskLevel === "L1") {
      return { decision: "auto", reason: "Baseline policy permits low-risk action" };
    }
    if (parsed.riskLevel === "L2") {
      return { decision: "deny", reason: "L2 requires an explicit project policy; baseline fails closed" };
    }
    if (parsed.channel === "local") {
      return { decision: "deny", reason: "External-risk action cannot use the local channel" };
    }
    return { decision: "require_approval", reason: "L3/L4 external actions require immutable owner approval" };
  }
}

export function requiresOwnerApproval(riskLevel: ActionRiskLevel): boolean {
  return riskLevel === "L3" || riskLevel === "L4";
}
