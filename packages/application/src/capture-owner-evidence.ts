import {
  createResearchEvidenceCapturedEvent,
  DomainError,
  newId,
  type Evidence,
  type UnitOfWork,
} from "@pios/domain";

export interface CaptureOwnerEvidenceInput {
  missionId: string;
  ownerId: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  confidence: number;
}

function assertPublicWebUrl(sourceUrl: string): void {
  if (!/^https?:\/\/[^\s]+$/i.test(sourceUrl)) {
    throw new DomainError("INVALID_EVIDENCE_URL", "Evidence URL must use http or https");
  }
}

/**
 * Стабильный portable fingerprint для owner-provided текста. Криптографический
 * SHA-256 для автоматически загруженных источников будет вычисляться
 * infrastructure adapter'ом, а application-слой не зависит от Node crypto.
 */
function fingerprint(value: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c];
  return seeds.map((seed) => {
    let hash = seed;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("");
}

export function createCaptureOwnerEvidence(unitOfWork: UnitOfWork) {
  return async function captureOwnerEvidence(input: CaptureOwnerEvidenceInput) {
    return unitOfWork.run(async (ctx) => {
      const mission = await ctx.missions.getById(input.missionId);
      if (!mission || mission.ownerId !== input.ownerId) {
        throw new DomainError("MISSION_NOT_FOUND", "Mission not found");
      }
      if (mission.status !== "planning" || mission.currentPhase !== "plan") {
        throw new DomainError("MISSION_NOT_READY_FOR_EVIDENCE", "Plan research before adding evidence");
      }
      assertPublicWebUrl(input.sourceUrl);
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: newId(),
        ownerId: input.ownerId,
        missionId: input.missionId,
        sourceUrl: input.sourceUrl,
        title: input.title,
        excerpt: input.excerpt,
        retrievedAt: now,
        contentHash: fingerprint(input.excerpt),
        provenance: { collector: "owner_provided", contentType: "text/plain" },
        confidence: input.confidence,
        createdAt: now,
      };
      await ctx.evidence.create(evidence);
      const event = createResearchEvidenceCapturedEvent(evidence);
      await ctx.events.append(event);
      return { evidence, event };
    });
  };
}

export type CaptureOwnerEvidence = ReturnType<typeof createCaptureOwnerEvidence>;
