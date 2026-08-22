import { randomUUID } from "node:crypto";
import type {
  ApprovalRepository,
  BrowserProfile,
  BrowserProfileRepository,
  BrowserSession,
  BrowserSessionRepository,
  DomainEvent,
  DurableJob,
  DurableJobRepository,
  Evidence,
  EvidenceRepository,
  EventStore,
  Goal,
  GoalRepository,
  Mission,
  MissionRepository,
  MemoryRecord,
  MemoryRepository,
  ModelCompletion,
  ModelRequest,
  ModelRouter,
  ResearchReport,
  ResearchReportRepository,
  ResearchReportVerification,
  ResearchReportVerificationRepository,
  Task,
  TaskRepository,
  UnitOfWork,
} from "@pios/domain";
import { describe, expect, it } from "vitest";
import { createCreateMission } from "./create-mission";
import { createDecideApproval } from "./approval";
import { createCreateBrowserProfile, createDisableBrowserProfile } from "./browser-profile";
import {
  createCloseBrowserSession,
  createRecordBrowserObservation,
  createRequestBrowserHumanTakeover,
  createReturnBrowserControlToAgent,
  createStartBrowserSession,
} from "./browser-session";
import {
  createConfirmMissionContract,
  createUpdateMissionContract,
} from "./mission-contract";
import { createPlanResearchMission } from "./plan-research-mission";
import { createCapturePublicEvidence } from "./capture-public-evidence";
import { createCaptureOwnerEvidence } from "./capture-owner-evidence";
import { createGenerateResearchReport } from "./generate-research-report";
import { createVerifyResearchReport } from "./verify-research-report";
import { createReconcileDurableJobs } from "./reconcile-durable-jobs";
import {
  createActivateMemory,
  createApproveMemory,
  createCreateMemoryCandidate,
  createForgetMemory,
} from "./memory";

function createFakeUnitOfWork() {
  const goals: Goal[] = [];
  const missions: Mission[] = [];
  const tasks: Task[] = [];
  const evidence: Evidence[] = [];
  const approvals: import("@pios/domain").ApprovalRequest[] = [];
  const browserProfiles: BrowserProfile[] = [];
  const browserSessions: BrowserSession[] = [];
  const durableJobs: DurableJob[] = [];
  const memories: MemoryRecord[] = [];
  const reports: ResearchReport[] = [];
  const reportVerifications: ResearchReportVerification[] = [];
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

  const approvalRepository: ApprovalRepository = {
    async create(request) { approvals.push(request); },
    async getById(requestId) { return approvals.find((request) => request.id === requestId) ?? null; },
    async update(request, expectedStatus) {
      const index = approvals.findIndex((item) => item.id === request.id && item.status === expectedStatus);
      if (index < 0) return false;
      approvals[index] = request;
      return true;
    },
    async listPendingByOwner(ownerId) { return approvals.filter((request) => request.ownerId === ownerId && request.status === "pending"); },
  };

  const browserProfileRepository: BrowserProfileRepository = {
    async create(profile) { browserProfiles.push(profile); },
    async getById(profileId) { return browserProfiles.find((profile) => profile.id === profileId) ?? null; },
    async listByOwner(ownerId) { return browserProfiles.filter((profile) => profile.ownerId === ownerId); },
    async update(profile, expectedVersion) {
      const index = browserProfiles.findIndex((item) => item.id === profile.id && item.version === expectedVersion);
      if (index < 0) return false;
      browserProfiles[index] = profile;
      return true;
    },
  };

  const browserSessionRepository: BrowserSessionRepository = {
    async create(session) { browserSessions.push(session); },
    async getById(sessionId) { return browserSessions.find((session) => session.id === sessionId) ?? null; },
    async listByOwner(ownerId) { return browserSessions.filter((session) => session.ownerId === ownerId); },
    async update(session, expectedVersion) {
      const index = browserSessions.findIndex((item) => item.id === session.id && item.version === expectedVersion);
      if (index < 0) return false;
      browserSessions[index] = session;
      return true;
    },
  };

  const durableJobRepository: DurableJobRepository = {
    async create(job) { durableJobs.push(job); },
    async listExpiredRunning(now) {
      return durableJobs.filter((job) => job.status === "running" && job.leaseExpiresAt !== null && job.leaseExpiresAt < now);
    },
    async update(job) {
      const index = durableJobs.findIndex((item) => item.id === job.id && item.status === "running");
      if (index < 0) return false;
      durableJobs[index] = job;
      return true;
    },
  };

  const memoryRepository: MemoryRepository = {
    async create(memory) {
      memories.push(memory);
    },
    async getById(memoryId) {
      return memories.find((memory) => memory.id === memoryId) ?? null;
    },
    async update(memory, expectedVersion) {
      const index = memories.findIndex((stored) => stored.id === memory.id);
      if (index < 0 || memories[index]?.version !== expectedVersion) return false;
      memories[index] = memory;
      return true;
    },
    async listByOwner(ownerId, options) {
      return memories.filter((memory) => memory.ownerId === ownerId && (options?.includeForgotten || memory.status !== "forgotten"));
    },
    async listActiveByScopeAndSubject(ownerId, scope, subject) {
      return memories.filter((memory) => memory.ownerId === ownerId && memory.scope === scope && memory.subject === subject && memory.status === "active");
    },
  };

  const reportRepository: ResearchReportRepository = {
    async create(report) {
      reports.push(report);
    },
    async getById(reportId) {
      return reports.find((report) => report.id === reportId) ?? null;
    },
    async listByMission(missionId) {
      return reports.filter((report) => report.missionId === missionId);
    },
  };

  const reportVerificationRepository: ResearchReportVerificationRepository = {
    async create(verification) {
      reportVerifications.push(verification);
    },
    async listByReport(reportId) {
      return reportVerifications.filter((verification) => verification.reportId === reportId);
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
      return fn({ goals: goalRepository, missions: missionRepository, tasks: taskRepository, evidence: evidenceRepository, approvals: approvalRepository, browserProfiles: browserProfileRepository, browserSessions: browserSessionRepository, durableJobs: durableJobRepository, memories: memoryRepository, reports: reportRepository, reportVerifications: reportVerificationRepository, events: eventStore });
    },
  };

  return { unitOfWork, goals, missions, tasks, evidence, browserProfiles, browserSessions, durableJobs, memories, reports, reportVerifications, events };
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

describe("Browser session control plane", () => {
  it("requires re-observation after human takeover before an agent session can become active again", async () => {
    const { unitOfWork, browserSessions, events } = createFakeUnitOfWork();
    const profile = await createCreateBrowserProfile(unitOfWork)({ ownerId: "owner-1", label: "Research", mode: "agent_isolated" });
    const start = createStartBrowserSession(unitOfWork);
    const observe = createRecordBrowserObservation(unitOfWork);
    const takeover = createRequestBrowserHumanTakeover(unitOfWork);
    const returnControl = createReturnBrowserControlToAgent(unitOfWork);
    const close = createCloseBrowserSession(unitOfWork);

    const started = await start({ ownerId: "owner-1", profileId: profile.profile.id });
    expect(started.session).toMatchObject({ status: "paused", controlOwner: "agent", reobservationRequired: true, version: 1 });
    const observed = await observe({ ownerId: "owner-1", sessionId: started.session.id, expectedVersion: 1 });
    expect(observed.session).toMatchObject({ status: "active", reobservationRequired: false, version: 2 });
    const human = await takeover({ ownerId: "owner-1", sessionId: observed.session.id, expectedVersion: 2 });
    expect(human.session).toMatchObject({ status: "paused", controlOwner: "human", reobservationRequired: true, version: 3 });
    const returned = await returnControl({ ownerId: "owner-1", sessionId: human.session.id, expectedVersion: 3 });
    expect(returned.session).toMatchObject({ status: "paused", controlOwner: "agent", reobservationRequired: true, version: 4 });
    const reobserved = await observe({ ownerId: "owner-1", sessionId: returned.session.id, expectedVersion: 4 });
    const closed = await close({ ownerId: "owner-1", sessionId: reobserved.session.id, expectedVersion: 5 });
    expect(closed.session).toMatchObject({ status: "closed", controlOwner: "paused", reobservationRequired: true, version: 6 });
    expect(browserSessions).toHaveLength(1);
    expect(events.slice(-6).map((event) => event.eventType)).toEqual([
      "BrowserSessionStarted", "BrowserSessionObserved", "BrowserSessionHumanTakeover",
      "BrowserSessionControlReturned", "BrowserSessionObserved", "BrowserSessionClosed",
    ]);
  });

  it("starts an owner-shared session under human control", async () => {
    const { unitOfWork } = createFakeUnitOfWork();
    const profile = await createCreateBrowserProfile(unitOfWork)({ ownerId: "owner-1", label: "Shared", mode: "owner_shared" });
    const session = await createStartBrowserSession(unitOfWork)({ ownerId: "owner-1", profileId: profile.profile.id });
    expect(session.session).toMatchObject({ status: "paused", controlOwner: "human", reobservationRequired: true });
    await expect(createRecordBrowserObservation(unitOfWork)({ ownerId: "owner-1", sessionId: session.session.id, expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "BROWSER_SESSION_INVALID_STATE" });
  });
});

describe("Browser profile control plane", () => {
  it("creates and disables an owner profile with versioned audit events", async () => {
    const { unitOfWork, browserProfiles, events } = createFakeUnitOfWork();
    const createProfile = createCreateBrowserProfile(unitOfWork);
    const disableProfile = createDisableBrowserProfile(unitOfWork);

    const created = await createProfile({ ownerId: "owner-1", label: "Isolated research", mode: "agent_isolated" });
    expect(created.profile).toMatchObject({ ownerId: "owner-1", label: "Isolated research", mode: "agent_isolated", status: "active", version: 1 });
    expect(browserProfiles).toHaveLength(1);
    expect(events.at(-1)?.eventType).toBe("BrowserProfileCreated");
    expect(events.at(-1)?.payload).not.toHaveProperty("label");

    const disabled = await disableProfile({ profileId: created.profile.id, ownerId: "owner-1", expectedVersion: 1 });
    expect(disabled.profile).toMatchObject({ status: "disabled", version: 2 });
    expect(events.at(-1)?.eventType).toBe("BrowserProfileDisabled");
  });

  it("rejects cross-owner and stale browser profile transitions", async () => {
    const { unitOfWork } = createFakeUnitOfWork();
    const createProfile = createCreateBrowserProfile(unitOfWork);
    const disableProfile = createDisableBrowserProfile(unitOfWork);
    const created = await createProfile({ ownerId: "owner-1", label: "General browser", mode: "owner_shared" });

    await expect(disableProfile({ profileId: created.profile.id, ownerId: "owner-2", expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "BROWSER_PROFILE_NOT_FOUND" });
    await expect(disableProfile({ profileId: created.profile.id, ownerId: "owner-1", expectedVersion: 99 }))
      .rejects.toMatchObject({ code: "BROWSER_PROFILE_VERSION_CONFLICT" });
  });
});

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


describe("VerifyResearchReport", () => {
  async function prepareReport() {
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
      contentHash: "c".repeat(64), confidence: 0.8,
    });
    const reportModel = new QueueModelRouter([JSON.stringify({
      title: "Черновик", summary: { text: "Есть источник.", evidenceIds: [captured.evidence.id] },
      claims: [{ statement: "Проверяемый текст сохранён.", evidenceIds: [captured.evidence.id], confidence: 0.8 }], limitations: [],
    })]);
    const generated = await createGenerateResearchReport(setup.unitOfWork, reportModel)({ missionId: created.mission.id, ownerId: "owner-1" });
    return { ...setup, missionId: created.mission.id, evidenceId: captured.evidence.id, reportId: generated.report.id };
  }

  it("сохраняет независимый result и needs_review при inconclusive claim", async () => {
    const setup = await prepareReport();
    const verifier = new QueueModelRouter([JSON.stringify({
      findings: [{ claimIndex: 0, verdict: "inconclusive", rationale: "Фрагмент слишком краток.", evidenceIds: [setup.evidenceId] }],
      limitations: ["Недостаточно контекста."],
    })]);

    const result = await createVerifyResearchReport(setup.unitOfWork, verifier)({
      missionId: setup.missionId, reportId: setup.reportId, ownerId: "owner-1",
    });

    expect(result.verification.verdict).toBe("needs_review");
    expect(setup.reportVerifications).toHaveLength(1);
    expect(setup.events.at(-1)?.eventType).toBe("ResearchReportVerified");
    expect(verifier.requests[0]?.capability).toBe("verification_strict");
  });

  it("отклоняет citation вне claim и использует ровно одну repair-попытку", async () => {
    const setup = await prepareReport();
    const verifier = new QueueModelRouter([
      JSON.stringify({
        findings: [{ claimIndex: 0, verdict: "supported", rationale: "Неверная ссылка.", evidenceIds: [randomUUID()] }], limitations: [],
      }),
      JSON.stringify({
        findings: [{ claimIndex: 0, verdict: "supported", rationale: "Фрагмент подтверждает claim.", evidenceIds: [setup.evidenceId] }], limitations: [],
      }),
    ]);

    const result = await createVerifyResearchReport(setup.unitOfWork, verifier)({
      missionId: setup.missionId, reportId: setup.reportId, ownerId: "owner-1",
    });

    expect(result.verification.verdict).toBe("passed");
    expect(result.verification.model.repairAttempted).toBe(true);
    expect(verifier.requests).toHaveLength(2);
  });
});


describe("MemoryLifecycle", () => {
  it("требует owner-review и создаёт revision chain вместо двух active фактов", async () => {
    const { unitOfWork, memories, events } = createFakeUnitOfWork();
    const createCandidate = createCreateMemoryCandidate(unitOfWork);
    const approve = createApproveMemory(unitOfWork);
    const activate = createActivateMemory(unitOfWork);

    const first = await createCandidate({
      ownerId: "owner-1", memoryType: "owner_preference", scope: "owner", subject: "language",
      content: "Предпочитает русский язык.", confidence: 0.9,
    });
    expect(first.memory.status).toBe("candidate");
    const firstApproved = await approve({ memoryId: first.memory.id, ownerId: "owner-1", expectedVersion: first.memory.version });
    const firstActive = await activate({ memoryId: first.memory.id, ownerId: "owner-1", expectedVersion: firstApproved.memory.version });
    expect(firstActive.memory.status).toBe("active");

    const second = await createCandidate({
      ownerId: "owner-1", memoryType: "owner_preference", scope: "owner", subject: "language",
      content: "Предпочитает русский язык и краткие ответы.", confidence: 0.95,
    });
    const secondApproved = await approve({ memoryId: second.memory.id, ownerId: "owner-1", expectedVersion: second.memory.version });
    const secondActive = await activate({ memoryId: second.memory.id, ownerId: "owner-1", expectedVersion: secondApproved.memory.version });

    expect(secondActive.memory.supersedesId).toBe(first.memory.id);
    expect(memories.find((memory) => memory.id === first.memory.id)?.status).toBe("superseded");
    expect(memories.filter((memory) => memory.status === "active")).toHaveLength(1);
    expect(events.map((event) => event.eventType).slice(-5)).toEqual([
      "MemoryActivated", "MemoryCandidateCreated", "MemoryApproved", "MemorySuperseded", "MemoryActivated",
    ]);
  });

  it("исключает forgotten запись из штатной памяти, сохраняя только metadata в audit event", async () => {
    const { unitOfWork, memories, events } = createFakeUnitOfWork();
    const candidate = await createCreateMemoryCandidate(unitOfWork)({
      ownerId: "owner-1", memoryType: "temporary_context", scope: "mission", subject: "private-note",
      content: "Содержимое, которое владелец потом забудет.", confidence: 0.5,
    });
    const approved = await createApproveMemory(unitOfWork)({
      memoryId: candidate.memory.id, ownerId: "owner-1", expectedVersion: candidate.memory.version,
    });
    const forgotten = await createForgetMemory(unitOfWork)({
      memoryId: candidate.memory.id, ownerId: "owner-1", expectedVersion: approved.memory.version,
    });

    expect(forgotten.memory.status).toBe("forgotten");
    expect(memories.filter((memory) => memory.status !== "forgotten")).toHaveLength(0);
    expect(events.at(-1)?.eventType).toBe("MemoryForgotten");
    expect(events.at(-1)?.payload).not.toHaveProperty("content");
  });

  it("не позволяет activate candidate до явного approval", async () => {
    const { unitOfWork } = createFakeUnitOfWork();
    const candidate = await createCreateMemoryCandidate(unitOfWork)({
      ownerId: "owner-1", memoryType: "project_fact", scope: "project", subject: "status",
      content: "Проект в разработке.", confidence: 0.7,
    });

    await expect(createActivateMemory(unitOfWork)({
      memoryId: candidate.memory.id, ownerId: "owner-1", expectedVersion: candidate.memory.version,
    })).rejects.toMatchObject({ code: "MEMORY_INVALID_STATUS" });
  });
});


describe("DurableJobRecovery", () => {
  it("блокирует истёкший running job вместо автоматического retry", async () => {
    const { unitOfWork, durableJobs } = createFakeUnitOfWork();
    durableJobs.push({
      id: randomUUID(), ownerId: "owner-1", missionId: null, jobType: "read_only_reconcile", payload: {},
      status: "running", attempt: 1, maxAttempts: 3, leaseOwner: "worker-a",
      leaseExpiresAt: "2026-08-21T00:00:00.000Z", lastHeartbeatAt: "2026-08-21T00:00:00.000Z",
      lastError: null, createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z",
    });

    const result = await createReconcileDurableJobs(unitOfWork)("2026-08-22T00:00:00.000Z");

    expect(result.blockedIds).toEqual([durableJobs[0]?.id]);
    expect(durableJobs[0]?.status).toBe("blocked_recovery");
    expect(durableJobs[0]?.lastError).toContain("requires explicit reconciliation");
  });
});


describe("ApprovalDecision", () => {
  it("разрешает owner approve только pending request и fail-closed при expiry", async () => {
    const { unitOfWork, events } = createFakeUnitOfWork();
    const request = {
      id: randomUUID(), ownerId: "owner-1", missionId: null, channel: "telegram" as const,
      actionKind: "send_message", riskLevel: "L3" as const, preview: "Send", payloadHash: "a".repeat(64),
      status: "pending" as const, expiresAt: "2099-01-01T00:00:00.000Z", decidedAt: null, consumedAt: null,
      createdAt: "2026-08-22T00:00:00.000Z",
    };
    await unitOfWork.run((ctx) => ctx.approvals.create(request));
    const decideApproval = createDecideApproval(unitOfWork);
    const approved = await decideApproval({ approvalId: request.id, ownerId: "owner-1", decision: "approved" });
    expect(approved.request.status).toBe("approved");
    expect(events.at(-1)?.eventType).toBe("ApprovalDecided");
    expect(events.at(-1)?.payload).not.toHaveProperty("preview");

    const expired = { ...request, id: randomUUID(), expiresAt: "2000-01-01T00:00:00.000Z" };
    await unitOfWork.run((ctx) => ctx.approvals.create(expired));
    const expiredResult = await decideApproval({ approvalId: expired.id, ownerId: "owner-1", decision: "approved" });
    expect(expiredResult.request.status).toBe("expired");
    expect(events.at(-1)?.eventType).toBe("ApprovalExpired");
  });
});
