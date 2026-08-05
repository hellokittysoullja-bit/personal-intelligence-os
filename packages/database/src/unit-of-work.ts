import type { UnitOfWork } from "@pios/domain";
import type { Database } from "./client";
import { createEventStore } from "./event-repository";
import { createGoalRepository } from "./goal-repository";
import { createMissionRepository } from "./mission-repository";

/** docs/decisions/ADR-004 — состояние и событие пишутся в одной транзакции. */
export function createUnitOfWork(db: Database): UnitOfWork {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({
          goals: createGoalRepository(tx),
          missions: createMissionRepository(tx),
          events: createEventStore(tx),
        });
      });
    },
  };
}
