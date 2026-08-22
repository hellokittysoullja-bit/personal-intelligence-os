import {
  createResearchEvidenceCapturedEvent,
  DomainError,
  newId,
  type Evidence,
  type UnitOfWork,
} from "@pios/domain";

export interface CapturePublicEvidenceInput {
  missionId: string;
  ownerId: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  contentType: string;
  retrievedAt: string;
  contentHash: string;
  confidence: number;
}

export function createCapturePublicEvidence(unitOfWork: UnitOfWork) {
  return async function capturePublicEvidence(input: CapturePublicEvidenceInput) {
    return unitOfWork.run(async (ctx) => {
      const mission = await ctx.missions.getById(input.missionId);
      if (!mission || mission.ownerId !== input.ownerId) {
        throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
      }
      if (mission.status !== "planning" || mission.currentPhase !== "plan") {
        throw new DomainError("MISSION_NOT_READY_FOR_EVIDENCE", "Plan research before collecting sources");
      }
      const evidence: Evidence = {
        id: newId(),
        ownerId: input.ownerId,
        missionId: input.missionId,
        sourceUrl: input.sourceUrl,
        title: input.title,
        excerpt: input.excerpt,
        retrievedAt: input.retrievedAt,
        contentHash: input.contentHash,
        provenance: { collector: "http_read_only", contentType: input.contentType },
        confidence: input.confidence,
        createdAt: new Date().toISOString(),
      };
      await ctx.evidence.create(evidence);
      const event = createResearchEvidenceCapturedEvent(evidence);
      await ctx.events.append(event);
      return { evidence, event };
    });
  };
}

export type CapturePublicEvidence = ReturnType<typeof createCapturePublicEvidence>;
