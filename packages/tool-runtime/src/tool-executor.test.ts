import type { ApprovalRequest, DomainEvent, UnitOfWork, UnitOfWorkContext } from "@pios/domain";
import { ConservativePolicyEngine } from "@pios/policy";
import { describe, expect, it } from "vitest";
import { hashToolPayload, ToolExecutor, type ToolDefinition } from "./tool-executor";

function createHarness() {
  const approvals = new Map<string, ApprovalRequest>();
  const events: DomainEvent[] = [];
  const approvalsRepository = {
    async create(approval: ApprovalRequest) { approvals.set(approval.id, approval); },
    async getById(id: string) { return approvals.get(id) ?? null; },
    async update(approval: ApprovalRequest, expectedStatus: ApprovalRequest["status"]) {
      const current = approvals.get(approval.id);
      if (!current || current.status !== expectedStatus) return false;
      approvals.set(approval.id, approval);
      return true;
    },
    async listPendingByOwner(ownerId: string) {
      return [...approvals.values()].filter((approval) => approval.ownerId === ownerId && approval.status === "pending");
    },
  };
  const unitOfWork: UnitOfWork = {
    async run(fn) {
      return fn({
        approvals: approvalsRepository,
        events: { async append(event: DomainEvent) { events.push(event); } },
      } as unknown as UnitOfWorkContext);
    },
  };
  return { approvals, events, executor: new ToolExecutor(new ConservativePolicyEngine(), unitOfWork) };
}

function browserSubmit(run: () => Promise<string>): ToolDefinition<{ url: string; message: string }, string> {
  return {
    name: "browser_submit",
    channel: "browser",
    actionKind: "submit_form",
    riskLevel: "L3",
    preview: ({ url, message }) => `Submit to ${url}: ${message}`,
    run: async () => run(),
  };
}

describe("ToolExecutor", () => {
  it("does not run L3 tool before owner approval, then consumes exactly the approved payload once", async () => {
    const { approvals, events, executor } = createHarness();
    let calls = 0;
    const tool = browserSubmit(async () => { calls += 1; return "sent"; });
    const payload = { url: "https://example.test/form", message: "hello" };

    const proposed = await executor.execute({ ownerId: "owner-1", tool, payload });
    expect(proposed.status).toBe("awaiting_approval");
    expect(calls).toBe(0);
    if (proposed.status !== "awaiting_approval") throw new Error("Expected approval proposal");
    expect(proposed.approval.payloadHash).toBe(hashToolPayload({ message: "hello", url: "https://example.test/form" }));
    expect(events.at(-1)?.eventType).toBe("ApprovalRequested");
    expect(events.at(-1)?.payload).not.toHaveProperty("preview");

    approvals.set(proposed.approval.id, { ...proposed.approval, status: "approved", decidedAt: "2026-08-23T12:00:00.000Z" });
    const executed = await executor.executeApproved({ ownerId: "owner-1", tool, payload, approvalId: proposed.approval.id });
    expect(executed).toEqual({ status: "executed", output: "sent" });
    expect(calls).toBe(1);
    expect(approvals.get(proposed.approval.id)?.status).toBe("consumed");
    expect(events.at(-1)?.eventType).toBe("ApprovalConsumed");

    await expect(executor.executeApproved({ ownerId: "owner-1", tool, payload, approvalId: proposed.approval.id }))
      .rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    expect(calls).toBe(1);
  });

  it("rejects a payload altered after approval without running the tool", async () => {
    const { approvals, executor } = createHarness();
    let calls = 0;
    const tool = browserSubmit(async () => { calls += 1; return "sent"; });
    const proposed = await executor.execute({ ownerId: "owner-1", tool, payload: { url: "https://example.test/form", message: "hello" } });
    if (proposed.status !== "awaiting_approval") throw new Error("Expected approval proposal");
    approvals.set(proposed.approval.id, { ...proposed.approval, status: "approved", decidedAt: "2026-08-23T12:00:00.000Z" });

    await expect(executor.executeApproved({
      ownerId: "owner-1", tool, approvalId: proposed.approval.id,
      payload: { url: "https://example.test/form", message: "changed" },
    })).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    expect(calls).toBe(0);
    expect(approvals.get(proposed.approval.id)?.status).toBe("approved");
  });

  it("expires an approved request without executing and denies L2 by default", async () => {
    const { approvals, executor } = createHarness();
    let calls = 0;
    const tool = browserSubmit(async () => { calls += 1; return "sent"; });
    const proposed = await executor.execute({ ownerId: "owner-1", tool, payload: { url: "https://example.test/form", message: "hello" } });
    if (proposed.status !== "awaiting_approval") throw new Error("Expected approval proposal");
    approvals.set(proposed.approval.id, {
      ...proposed.approval, status: "approved", expiresAt: "2020-01-01T00:00:00.000Z", decidedAt: "2019-12-31T00:00:00.000Z",
    });
    await expect(executor.executeApproved({
      ownerId: "owner-1", tool, approvalId: proposed.approval.id, payload: { url: "https://example.test/form", message: "hello" },
    })).resolves.toMatchObject({ status: "expired" });
    expect(calls).toBe(0);
    expect(approvals.get(proposed.approval.id)?.status).toBe("expired");

    const denied = await executor.execute({
      ownerId: "owner-1",
      tool: { name: "install", channel: "local", actionKind: "install_dependency", riskLevel: "L2", preview: () => "install", run: async () => "unsafe" },
      payload: {},
    });
    expect(denied).toMatchObject({ status: "denied" });
  });
});
