import { randomUUID } from "node:crypto";
import type {
  DomainEvent,
  Evidence,
  EvidenceRepository,
  EventStore,
  Goal,
  GoalRepository,
  Mission,
  MissionRepository,
  ModelCompletion,
  ModelRequest,
  ModelRouter,
  ResearchReport,
  ResearchReportRepository,
  Task,
  TaskRepository,
  UnitOfWork,
} from "@pios/domain";
import { describe, expect, it } from "vitest";
import { createCreateMission } from "./create-mission";
import {
  createConfirmMissionContract,
  createUpdateMissionContract,
} from "./mission-contract";
import { createPlanResearchMission } from "./plan-research-mission";
import { createCapturePublicEvidence } from "./capture-public-evidence";
import { createCaptureOwnerEvidence } from "./capture-owner-evidence";
import { createGenerateResearchReport } from "./generate-research-report";

function createFakeUnitOfWork() {
  const goals: Goal[] = [];
  const missions: Mission[] = [];
  const tasks: Task[] = [];
  const evidence: Evidence[] = [];
  const reports: ResearchReport[] = [];
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
    async update(mission, expectedVersion) {
      const index = missions.findIndex((stored) => stored.id === mission.id);
      if (index < 0 || missions[index]?.version !== expectedVersion) return false;
      missions[index] = mission;
      return true;
    },
  };

  const taskRepository: TaskRepository = {
    async create(task) {
      tasks.push(task);
    },
    async listByMission(missionId) {
      return tasks.filter((task) => task.missionId === missionId);
    },
  };

  const evidenceRepository: EvidenceRepository = {
    async create(item) {
      evidence.push(item);
    },
    async listByMission(missionId) {
      return evidence.filter((item) => item.missionId === missionId);
    },
  };

  const reportRepository: ResearchReportRepository = {
    async create(report) {
      reports.push(report);
    },
    async listByMission(missionId) {
      return reports.filter((report) => report.missionId === missionId);
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
      return fn({ goals: goalRepository, missions: missionRepository, tasks: taskRepository, evidence: evidenceRepository, reports: reportRepository, events: eventStore });
    },
  };

  return { unitOfWork, goals, missions, tasks, evidence, reports, events };
}

class QueueModelRouter implements ModelRouter {
  readonly requests: ModelRequest[] = [];

  constructor(private readonly outputs: string[]) {}

  async complete(request: ModelRequest): Promise<ModelCompletion> {
    this.requests.push(request);
    const text = this.outputs.shift();
    if (!text) throw new Error("No fake model output queued");
    return {
      text,
      providerId: "fake",
      model: "fake-model",
      requestId: randomUUID(),
      usage: { providerId: "fake", model: "fake-model", promptTokens: 10, completionTokens: 20, totalTokens: 30, estimatedCostUsd: null },
    };
  }
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


describe("MissionContract", () => {
  it("сохраняет контракт и подтверждает его без запуска инструментов", async () => {
    const { unitOfWork, events } = createFakeUnitOfWork();
    const createMission = createCreateMission(unitOfWork);
    const updateContract = createUpdateMissionContract(unitOfWork);
    const confirmContract = createConfirmMissionContract(unitOfWork);
    const created = await createMission({ ownerId: "owner-1", rawRequest: "Собери отчёт" });

    const updated = await updateContract({
      missionId: created.mission.id,
      ownerId: "owner-1",
      expectedVersion: created.mission.version,
      objective: "Собрать еженедельный отчёт по продажам",
      autonomyLevel: "supervised",
      riskLevel: "L1",
      budget: created.mission.budget,
      successCriteria: ["Отчёт содержит выручку и динамику за неделю"],
      constraints: ["Не выполнять внешние действия"],
      unknowns: [],
      assumptions: [],
      stopConditions: ["Остановиться при отсутствии данных"],
    });
    expect(updated.mission.currentPhase).toBe("contract");
    expect(updated.mission.version).toBe(2);
    expect(updated.event.eventType).toBe("MissionContractUpdated");

    const confirmed = await confirmContract({
      missionId: updated.mission.id,
      ownerId: "owner-1",
      expectedVersion: updated.mission.version,
    });
    expect(confirmed.mission.status).toBe("understanding");
    expect(confirmed.mission.currentPhase).toBe("understand");
    expect(confirmed.event.eventType).toBe("MissionContractConfirmed");
    expect(events.map((event) => event.eventType)).toEqual([
      "MissionCreated",
      "MissionContractUpdated",
      "MissionContractConfirmed",
    ]);
  });
});


describe("PlanResearchMission", () => {
  it("создаёт read-only исследовательский план только после подтверждения контракта", async () => {
    const { unitOfWork, tasks, events } = createFakeUnitOfWork();
    const created = await createCreateMission(unitOfWork)({ ownerId: "owner-1", rawRequest: "Исследуй рынок" });
    const updated = await createUpdateMissionContract(unitOfWork)({
      missionId: created.mission.id,
      ownerId: "owner-1",
      expectedVersion: created.mission.version,
      objective: "Исследовать рынок и подготовить отчёт",
      autonomyLevel: "supervised",
      riskLevel: "L1",
      budget: created.mission.budget,
      successCriteria: ["В отчёте есть проверенные источники"],
      constraints: ["Только чтение публичных источников"],
      unknowns: [],
      assumptions: [],
      stopConditions: [],
    });
    const confirmed = await createConfirmMissionContract(unitOfWork)({
      missionId: updated.mission.id,
      ownerId: "owner-1",
      expectedVersion: updated.mission.version,
    });

    const result = await createPlanResearchMission(unitOfWork)({
      missionId: confirmed.mission.id,
      ownerId: "owner-1",
      expectedVersion: confirmed.mission.version,
    });

    expect(result.mission.status).toBe("planning");
    expect(result.mission.currentPhase).toBe("plan");
    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.title)).toEqual([
      "Собрать источники",
      "Собрать исследовательский отчёт",
      "Проверить отчёт",
    ]);
    expect(tasks.every((task) => task.taskType === "research")).toBe(true);
    expect(events.at(-1)?.eventType).toBe("MissionResearchPlanned");
  });
});


describe("CaptureOwnerEvidence", () => {
  it("сохраняет owner-provided evidence только в планируемой research миссии", async () => {
    const { unitOfWork, evidence, events } = createFakeUnitOfWork();
    const created = await createCreateMission(unitOfWork)({ ownerId: "owner-1", rawRequest: "Исследуй рынок" });
    const updated = await createUpdateMissionContract(unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", expectedVersion: created.mission.version,
      objective: "Исследовать рынок", autonomyLevel: "supervised", riskLevel: "L1", budget: created.mission.budget,
      successCriteria: ["Есть источник"], constraints: [], unknowns: [], assumptions: [], stopConditions: [],
    });
    const confirmed = await createConfirmMissionContract(unitOfWork)({ missionId: updated.mission.id, ownerId: "owner-1", expectedVersion: updated.mission.version });
    await createPlanResearchMission(unitOfWork)({ missionId: confirmed.mission.id, ownerId: "owner-1", expectedVersion: confirmed.mission.version });

    const result = await createCaptureOwnerEvidence(unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", sourceUrl: "https://example.com/source",
      title: "Проверенный источник", excerpt: "Проверяемый фрагмент источника", confidence: 0.8,
    });

    expect(evidence).toHaveLength(1);
    expect(result.evidence.contentHash).toHaveLength(64);
    expect(result.evidence.provenance.collector).toBe("owner_provided");
    expect(events.at(-1)?.eventType).toBe("ResearchEvidenceCaptured");
  });
});


describe("CapturePublicEvidence", () => {
  it("сохраняет public read-only source с корректным provenance", async () => {
    const { unitOfWork, evidence, events } = createFakeUnitOfWork();
    const created = await createCreateMission(unitOfWork)({ ownerId: "owner-1", rawRequest: "Исследуй рынок" });
    const updated = await createUpdateMissionContract(unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", expectedVersion: created.mission.version,
      objective: "Исследовать рынок", autonomyLevel: "supervised", riskLevel: "L1", budget: created.mission.budget,
      successCriteria: ["Есть источники"], constraints: [], unknowns: [], assumptions: [], stopConditions: [],
    });
    const confirmed = await createConfirmMissionContract(unitOfWork)({ missionId: updated.mission.id, ownerId: "owner-1", expectedVersion: updated.mission.version });
    await createPlanResearchMission(unitOfWork)({ missionId: confirmed.mission.id, ownerId: "owner-1", expectedVersion: confirmed.mission.version });

    const result = await createCapturePublicEvidence(unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", sourceUrl: "https://example.com/source",
      title: "Источник", excerpt: "Проверяемый открытый текст", contentType: "text/html",
      retrievedAt: "2026-08-22T00:00:00.000Z", contentHash: "a".repeat(64), confidence: 0.5,
    });

    expect(evidence).toHaveLength(1);
    expect(result.evidence.provenance.collector).toBe("http_read_only");
    expect(events.at(-1)?.eventType).toBe("ResearchEvidenceCaptured");
  });
});


describe("GenerateResearchReport", () => {
  async function preparePlannedMissionWithEvidence() {
    const setup = createFakeUnitOfWork();
    const created = await createCreateMission(setup.unitOfWork)({ ownerId: "owner-1", rawRequest: "Исследуй рынок" });
    const updated = await createUpdateMissionContract(setup.unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", expectedVersion: created.mission.version,
      objective: "Исследовать рынок", autonomyLevel: "supervised", riskLevel: "L1", budget: created.mission.budget,
      successCriteria: ["Есть проверяемые источники"], constraints: ["Только чтение"], unknowns: [], assumptions: [], stopConditions: [],
    });
    const confirmed = await createConfirmMissionContract(setup.unitOfWork)({ missionId: updated.mission.id, ownerId: "owner-1", expectedVersion: updated.mission.version });
    await createPlanResearchMission(setup.unitOfWork)({ missionId: confirmed.mission.id, ownerId: "owner-1", expectedVersion: confirmed.mission.version });
    const captured = await createCapturePublicEvidence(setup.unitOfWork)({
      missionId: created.mission.id, ownerId: "owner-1", sourceUrl: "https://example.com/source", title: "Источник",
      excerpt: "Проверяемый открытый текст", contentType: "text/html", retrievedAt: "2026-08-22T00:00:00.000Z",
      contentHash: "b".repeat(64), confidence: 0.8,
    });
    return { ...setup, missionId: created.mission.id, evidenceId: captured.evidence.id };
  }

  it("сохраняет citation-bound draft и append-only event из допустимых evidence IDs", async () => {
    const setup = await preparePlannedMissionWithEvidence();
    const model = new QueueModelRouter([JSON.stringify({
      title: "Черновик исследования",
      summary: { text: "Источник содержит открытый текст.", evidenceIds: [setup.evidenceId] },
      claims: [{ statement: "Есть проверяемый фрагмент.", evidenceIds: [setup.evidenceId], confidence: 0.8 }],
      limitations: ["Использован один источник."],
    })]);

    const result = await createGenerateResearchReport(setup.unitOfWork, model)({ missionId: setup.missionId, ownerId: "owner-1" });

    expect(setup.reports).toHaveLength(1);
    expect(result.report.citedEvidenceIds).toEqual([setup.evidenceId]);
    expect(result.report.model.repairAttempted).toBe(false);
    expect(setup.events.at(-1)?.eventType).toBe("ResearchReportDrafted");
    expect(model.requests[0]?.capability).toBe("research_long_context");
  });

  it("отвергает неизвестную citation и выполняет только одну repair-попытку", async () => {
    const setup = await preparePlannedMissionWithEvidence();
    const model = new QueueModelRouter([
      JSON.stringify({
        title: "Плохой черновик", summary: { text: "Неверная ссылка.", evidenceIds: [randomUUID()] },
        claims: [{ statement: "Неверно", evidenceIds: [randomUUID()], confidence: 0.4 }], limitations: [],
      }),
      JSON.stringify({
        title: "Исправленный черновик", summary: { text: "Есть источник.", evidenceIds: [setup.evidenceId] },
        claims: [{ statement: "Проверяемый текст сохранён.", evidenceIds: [setup.evidenceId], confidence: 0.8 }], limitations: [],
      }),
    ]);

    const result = await createGenerateResearchReport(setup.unitOfWork, model)({ missionId: setup.missionId, ownerId: "owner-1" });

    expect(result.report.model.repairAttempted).toBe(true);
    expect(model.requests).toHaveLength(2);
    expect(result.report.citedEvidenceIds).toEqual([setup.evidenceId]);
  });

  it("не вызывает модель, если mission ещё не имеет evidence", async () => {
    const setup = createFakeUnitOfWork();
    const created = await createCreateMission(setup.unitOfWork)({ ownerId: "owner-1", rawRequest: "Исследуй рынок" });
    const model = new QueueModelRouter(["{}"]);

    await expect(createGenerateResearchReport(setup.unitOfWork, model)({ missionId: created.mission.id, ownerId: "owner-1" }))
      .rejects.toMatchObject({ code: "MISSION_NOT_READY_FOR_REPORT" });
    expect(model.requests).toHaveLength(0);
  });
});
