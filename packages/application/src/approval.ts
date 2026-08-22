import {
  createApprovalDecidedEvent,
  createApprovalExpiredEvent,
  DomainError,
  decideApproval,
  type UnitOfWork,
} from "@pios/domain";

export interface DecideApprovalInput {
  approvalId: string;
  ownerId: string;
  decision: "approved" | "rejected";
}

export function createDecideApproval(unitOfWork: UnitOfWork) {
  return async function decideApprovalRequest(input: DecideApprovalInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.approvals.getById(input.approvalId);
      if (!current || current.ownerId !== input.ownerId) throw new DomainError("APPROVAL_NOT_FOUND", "Approval request not found");
      const request = decideApproval(current, input.decision);
      if (!await ctx.approvals.update(request, "pending")) {
        throw new DomainError("APPROVAL_CONFLICT", "Approval changed concurrently; reload before retrying");
      }
      await ctx.events.append(request.status === "expired"
        ? createApprovalExpiredEvent(request)
        : createApprovalDecidedEvent(request));
      return { request };
    });
  };
}

export type DecideApproval = ReturnType<typeof createDecideApproval>;
