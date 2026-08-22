import { createHash, randomUUID } from "node:crypto";
import {
  approvalRequestSchema,
  consumeApproval,
  createApprovalConsumedEvent,
  createApprovalExpiredEvent,
  createApprovalRequestedEvent,
  DomainError,
  type ActionRiskLevel,
  type ApprovalRequest,
  type UnitOfWork,
} from "@pios/domain";
import type { PolicyEngine, ToolChannel } from "@pios/policy";

export interface ToolDefinition<Payload, Output> {
  name: string;
  channel: ToolChannel;
  actionKind: string;
  riskLevel: ActionRiskLevel;
  preview(payload: Payload): string;
  run(payload: Payload): Promise<Output>;
}

export type ToolExecutionResult<Output> =
  | { status: "denied"; reason: string }
  | { status: "awaiting_approval"; approval: ApprovalRequest }
  | { status: "expired"; approval: ApprovalRequest }
  | { status: "executed"; output: Output };

export class ToolRuntimeError extends Error {
  constructor(
    public readonly code: "TOOL_PAYLOAD_INVALID" | "APPROVAL_CHANNEL_MISMATCH" | "APPROVAL_ACTION_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "ToolRuntimeError";
  }
}

/**
 * The sole tool execution gateway. A tool is not called from this package
 * unless PolicyEngine returns auto, or an exact immutable approval has been
 * consumed atomically first. This package has no registry in this slice, so
 * no browser/network adapter is registered or reachable yet.
 */
export class ToolExecutor {
  constructor(
    private readonly policy: PolicyEngine,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute<Payload, Output>(
    input: { ownerId: string; missionId?: string | null; tool: ToolDefinition<Payload, Output>; payload: Payload },
  ): Promise<ToolExecutionResult<Output>> {
    const decision = this.policy.decide({
      toolName: input.tool.name,
      actionKind: input.tool.actionKind,
      channel: input.tool.channel,
      riskLevel: input.tool.riskLevel,
    });

    if (decision.decision === "deny") return { status: "denied", reason: decision.reason };
    if (decision.decision === "auto") return { status: "executed", output: await input.tool.run(input.payload) };

    const payloadHash = hashToolPayload(input.payload);
    const preview = input.tool.preview(input.payload).trim();
    if (!preview) throw new ToolRuntimeError("TOOL_PAYLOAD_INVALID", "Tool preview must not be empty");
    const now = new Date();
    const approval = approvalRequestSchema.parse({
      id: randomUUID(),
      ownerId: input.ownerId,
      missionId: input.missionId ?? null,
      channel: input.tool.channel,
      actionKind: input.tool.actionKind,
      riskLevel: input.tool.riskLevel,
      preview,
      payloadHash,
      status: "pending",
      expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
      decidedAt: null,
      consumedAt: null,
      createdAt: now.toISOString(),
    });
    await this.unitOfWork.run(async (ctx) => {
      await ctx.approvals.create(approval);
      await ctx.events.append(createApprovalRequestedEvent(approval));
    });
    return { status: "awaiting_approval", approval };
  }

  async executeApproved<Payload, Output>(
    input: { ownerId: string; tool: ToolDefinition<Payload, Output>; payload: Payload; approvalId: string },
  ): Promise<ToolExecutionResult<Output>> {
    const decision = this.policy.decide({
      toolName: input.tool.name,
      actionKind: input.tool.actionKind,
      channel: input.tool.channel,
      riskLevel: input.tool.riskLevel,
    });
    if (decision.decision !== "require_approval") return { status: "denied", reason: "Tool does not have an approval-gated policy decision" };

    const payloadHash = hashToolPayload(input.payload);
    const consumed = await this.unitOfWork.run(async (ctx) => {
      const current = await ctx.approvals.getById(input.approvalId);
      if (!current || current.ownerId !== input.ownerId) {
        throw new DomainError("APPROVAL_NOT_FOUND", "Approval request not found");
      }
      if (current.channel !== input.tool.channel) {
        throw new ToolRuntimeError("APPROVAL_CHANNEL_MISMATCH", "Approval channel does not match the tool");
      }
      if (current.actionKind !== input.tool.actionKind) {
        throw new ToolRuntimeError("APPROVAL_ACTION_MISMATCH", "Approval action does not match the tool");
      }
      let approval: ApprovalRequest;
      try {
        approval = consumeApproval(current, payloadHash);
      } catch (error) {
        throw new DomainError("APPROVAL_INVALID", error instanceof Error ? error.message : "Approval cannot be consumed");
      }
      if (!await ctx.approvals.update(approval, "approved")) {
        throw new DomainError("APPROVAL_CONFLICT", "Approval changed concurrently; reload before retrying");
      }
      await ctx.events.append(approval.status === "expired"
        ? createApprovalExpiredEvent(approval)
        : createApprovalConsumedEvent(approval));
      return approval;
    });

    if (consumed.status === "expired") return { status: "expired", approval: consumed };
    return { status: "executed", output: await input.tool.run(input.payload) };
  }
}

/** Stable, JSON-only serialization prevents a semantically changed payload from sharing an approval hash. */
export function hashToolPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ToolRuntimeError("TOOL_PAYLOAD_INVALID", "Tool payload numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  throw new ToolRuntimeError("TOOL_PAYLOAD_INVALID", "Tool payload must contain JSON-compatible values only");
}
