import type {
  ResearchReportVerification,
  ResearchReportVerificationRepository,
} from "@pios/domain";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { researchReportVerifications } from "./schema";

function toDomain(row: typeof researchReportVerifications.$inferSelect): ResearchReportVerification {
  return {
    id: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    reportId: row.reportId,
    verdict: row.verdict as ResearchReportVerification["verdict"],
    content: row.content,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createResearchReportVerificationRepository(
  executor: Executor,
): ResearchReportVerificationRepository {
  return {
    async create(verification) {
      await executor.insert(researchReportVerifications).values({
        id: verification.id,
        ownerId: verification.ownerId,
        missionId: verification.missionId,
        reportId: verification.reportId,
        verdict: verification.verdict,
        content: verification.content,
        model: verification.model,
        createdAt: new Date(verification.createdAt),
      });
    },
    async listByReport(reportId) {
      const rows = await executor
        .select()
        .from(researchReportVerifications)
        .where(eq(researchReportVerifications.reportId, reportId))
        .orderBy(asc(researchReportVerifications.createdAt));
      return rows.map(toDomain);
    },
  };
}
