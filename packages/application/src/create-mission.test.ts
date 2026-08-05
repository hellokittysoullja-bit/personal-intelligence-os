import type {
  DomainEvent,
  EventStore,
  Goal,
  GoalRepository,
  Mission,
  MissionRepository,
  UnitOfWork,
} from "@pios/domain";
import { describe, expect, it } from "vitest";
import { createCreateMission } from "./create-mission";

function createFakeUnitOfWork() {
  const goals: Goal[] = [];
  const missions: Mission[] = [];
  const events: DomainEvent[] = [];

  const goalRepository: GoalRepository = {
    async create(goal) {
      goals.push(goal);
    },
    async getById(id) {
      return goals.find((g) => g.id === id) ?? null;
    },
  };

  const missionRepository: MissionRepository = {
    async create(mission) {
      missions.push(mission);
    },
    async getById(id) {
      return missions.find((m) => m.id === id) ?? null;
    },
    async list(ownerId) {
      return missions.filter((m) => m.ownerId === ownerId);
    },
  };

  const eventStore: EventStore = {
    async append(event) {
      events.push(event);
    },
    async listByMission(missionId) {
      return events.filter((e) => e.missionId === missionId);
    },
    async getById(eventId) {
      return events.find((e) => e.eventId === eventId) ?? null;
    },
  };

  const unitOfWork: UnitOfWork = {
    async run(fn) {
      return fn({ goals: goalRepository, missions: missionRepository, events: eventStore });
    },
  };

  return { unitOfWork, goals, missions, events };
}

describe("CreateMission", () => {
  it("создаёт Goal, Mission и событие MissionCreated атомарно", async () => {
    const { unitOfWork, goals, missions, events } = createFakeUnitOfWork();
    const createMission = createCreateMission(unitOfWork);

    const result = await createMission({
      ownerId: "owner-1",
      rawRequest: "Собери еженедельный отчёт по продажам",
    });

    expect(goals).toHaveLength(1);
    expect(missions).toHaveLength(1);
    expect(events).toHaveLength(1);

    expect(result.mission.status).toBe("created");
    expect(result.mission.currentPhase).toBe("intake");
    expect(result.mission.goalId).toBe(goals[0]?.id);
    expect(result.mission.objective).toBe("Собери еженедельный отчёт по продажам");
    expect(result.event.eventType).toBe("MissionCreated");
    expect(result.event.missionId).toBe(result.mission.id);
  });

  it("обрезает длинный rawRequest до заголовка ограниченной длины", async () => {
    const { unitOfWork } = createFakeUnitOfWork();
    const createMission = createCreateMission(unitOfWork);
    const longRequest = "а".repeat(200);

    const result = await createMission({ ownerId: "owner-1", rawRequest: longRequest });

    expect(result.mission.title.length).toBeLessThanOrEqual(80);
    expect(result.mission.objective).toBe(longRequest);
  });

  it("выставляет бюджет по умолчанию с пределами на субагентов (ADR-009)", async () => {
    const { unitOfWork } = createFakeUnitOfWork();
    const createMission = createCreateMission(unitOfWork);

    const result = await createMission({ ownerId: "owner-1", rawRequest: "тест" });

    expect(result.mission.budget.maxConcurrentAgentJobs).toBeGreaterThan(0);
    expect(result.mission.budget.maxAgentJobDepth).toBeGreaterThanOrEqual(0);
  });
});
