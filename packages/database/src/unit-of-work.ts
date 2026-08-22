import type { UnitOfWork } from "@pios/domain";
import type { Database } from "./client";
import { createEvidenceRepository } from "./evidence-repository";
import { createEventStore } from "./event-repository";
import { createGoalRepository } from "./goal-repository";
import { createMissionRepository } from "./mission-repository";
import { createResearchReportRepository } from "./research-report-repository";
import { createResearchReportVerificationRepository } from "./research-report-verification-repository";
import { createTaskRepository } from "./task-repository";

/** docs/decisions/ADR-004 — состояние и событие пишутся в одной транзакции. */
export function createUnitOfWork(db: Database): UnitOfWork {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({
          goals: createGoalRepository(tx),
          missions: createMissionRepository(tx),
          tasks: createTaskRepository(tx),
          evidence: createEvidenceRepository(tx),
          reports: createResearchReportRepository(tx),
          reportVerifications: createResearchReportVerificationRepository(tx),
          events: createEventStore(tx),
        });
      });
    },
  };
}
