import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consumeApproval, decideApproval, type ApprovalRequest } from "./approval";

function request(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: randomUUID(), ownerId: "owner", missionId: null, channel: "telegram", actionKind: "send_message",
    riskLevel: "L3", preview: "Send a message", payloadHash: "a".repeat(64), status: "pending",
    expiresAt: "2026-08-23T12:00:00.000Z", decidedAt: null, consumedAt: null,
    createdAt: "2026-08-22T12:00:00.000Z", ...overrides,
  };
}

describe("ApprovalRequest", () => {
  it("потребляется ровно один раз и только с неизменным payload hash", () => {
    const approved = decideApproval(request(), "approved", "2026-08-22T12:01:00.000Z");
    const consumed = consumeApproval(approved, "a".repeat(64), "2026-08-22T12:02:00.000Z");
    expect(consumed.status).toBe("consumed");
    expect(() => consumeApproval(consumed, "a".repeat(64))).toThrow("not approved");
  });

  it("fail-closed при изменённом payload или истёкшем approval", () => {
    const approved = decideApproval(request(), "approved", "2026-08-22T12:01:00.000Z");
    expect(() => consumeApproval(approved, "b".repeat(64))).toThrow("payload hash mismatch");
    const expired = decideApproval(request({ expiresAt: "2026-08-22T11:00:00.000Z" }), "approved", "2026-08-22T12:00:00.000Z");
    expect(expired.status).toBe("expired");
  });
});
