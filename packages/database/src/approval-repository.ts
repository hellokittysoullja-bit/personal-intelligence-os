import type { ApprovalRepository, ApprovalRequest } from "@pios/domain";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Executor } from "./client";
import { approvalRequests } from "./schema";

function toDomain(row: typeof approvalRequests.$inferSelect): ApprovalRequest {
  return {
    id: row.id, ownerId: row.ownerId, missionId: row.missionId,
    channel: row.channel as ApprovalRequest["channel"], actionKind: row.actionKind,
    riskLevel: row.riskLevel as ApprovalRequest["riskLevel"], preview: row.preview,
    payloadHash: row.payloadHash, status: row.status as ApprovalRequest["status"],
    expiresAt: row.expiresAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
  };
}

export function createApprovalRepository(executor: Executor): ApprovalRepository {
  return {
    async create(request) {
      await executor.insert(approvalRequests).values({
        ...request,
        expiresAt: new Date(request.expiresAt),
        decidedAt: request.decidedAt ? new Date(request.decidedAt) : null,
        consumedAt: request.consumedAt ? new Date(request.consumedAt) : null,
        createdAt: new Date(request.createdAt),
      });
    },
    async getById(requestId) {
      const rows = await executor.select().from(approvalRequests).where(eq(approvalRequests.id, requestId));
      return rows[0] ? toDomain(rows[0]) : null;
    },
    async update(request, expectedStatus) {
      const changed = await executor.update(approvalRequests).set({
        status: request.status, decidedAt: request.decidedAt ? new Date(request.decidedAt) : null,
        consumedAt: request.consumedAt ? new Date(request.consumedAt) : null,
      }).where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, expectedStatus))).returning({ id: approvalRequests.id });
      return changed.length === 1;
    },
    async listPendingByOwner(ownerId) {
      const rows = await executor.select().from(approvalRequests).where(and(
        eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), gt(approvalRequests.expiresAt, new Date()),
      )).orderBy(asc(approvalRequests.expiresAt));
      return rows.map(toDomain);
    },
  };
}
