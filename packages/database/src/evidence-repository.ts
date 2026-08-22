import type { Evidence, EvidenceRepository } from "@pios/domain";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { evidence } from "./schema";

function toDomain(row: typeof evidence.$inferSelect): Evidence {
  return {
    id: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    sourceUrl: row.sourceUrl,
    title: row.title,
    excerpt: row.excerpt,
    retrievedAt: row.retrievedAt.toISOString(),
    contentHash: row.contentHash,
    provenance: row.provenance,
    confidence: row.confidence / 10_000,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createEvidenceRepository(executor: Executor): EvidenceRepository {
  return {
    async create(item) {
      await executor.insert(evidence).values({
        id: item.id,
        ownerId: item.ownerId,
        missionId: item.missionId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        excerpt: item.excerpt,
        retrievedAt: new Date(item.retrievedAt),
        contentHash: item.contentHash,
        provenance: item.provenance,
        confidence: Math.round(item.confidence * 10_000),
        createdAt: new Date(item.createdAt),
      });
    },
    async listByMission(missionId) {
      const rows = await executor
        .select()
        .from(evidence)
        .where(eq(evidence.missionId, missionId))
        .orderBy(asc(evidence.createdAt));
      return rows.map(toDomain);
    },
  };
}
