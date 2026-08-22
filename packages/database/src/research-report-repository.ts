import type { ResearchReport, ResearchReportRepository } from "@pios/domain";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { researchReports } from "./schema";

function toDomain(row: typeof researchReports.$inferSelect): ResearchReport {
  return {
    id: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    status: "draft",
    content: row.content,
    citedEvidenceIds: row.citedEvidenceIds,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createResearchReportRepository(executor: Executor): ResearchReportRepository {
  return {
    async create(report) {
      await executor.insert(researchReports).values({
        id: report.id,
        ownerId: report.ownerId,
        missionId: report.missionId,
        status: report.status,
        content: report.content,
        citedEvidenceIds: report.citedEvidenceIds,
        model: report.model,
        createdAt: new Date(report.createdAt),
      });
    },
    async listByMission(missionId) {
      const rows = await executor
        .select()
        .from(researchReports)
        .where(eq(researchReports.missionId, missionId))
        .orderBy(asc(researchReports.createdAt));
      return rows.map(toDomain);
    },
  };
}
