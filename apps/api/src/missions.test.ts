import { randomUUID } from "node:crypto";
import {
  createCaptureOwnerEvidence,
  createCreateBrowserProfile,
  createDisableBrowserProfile,
  createDecideApproval,
  createCapturePublicEvidence,
  createConfirmMissionContract,
  createCreateMission,
  createCreateMemoryCandidate,
  createApproveMemory,
  createActivateMemory,
  createForgetMemory,
  createPlanResearchMission,
  createUpdateMissionContract,
} from "@pios/application";
import {
  createDatabaseClient,
  createEventBus,
  createEventStore,
  createEvidenceRepository,
  createApprovalRepository,
  createBrowserProfileRepository,
  createMissionRepository,
  createMemoryRepository,
  createResearchReportRepository,
  createResearchReportVerificationRepository,
  createTaskRepository,
  createUnitOfWork,
} from "@pios/database";
import { createLogger } from "@pios/observability";
import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe.skipIf(!process.env.DATABASE_URL)("apps/api mission routes (real Postgres)", () => {
  async function setup() {
    const logger = createLogger({ service: "api-test", level: "silent" });
    const db = createDatabaseClient(process.env.DATABASE_URL as string);
    const eventBus = createEventBus(db.sql);
    await eventBus.start();

    const unitOfWork = createUnitOfWork(db.db);
    const missionRepository = createMissionRepository(db.db);
    const approvalRepository = createApprovalRepository(db.db);
    const browserProfileRepository = createBrowserProfileRepository(db.db);
    const memoryRepository = createMemoryRepository(db.db);
    const taskRepository = createTaskRepository(db.db);
    const eventStore = createEventStore(db.db);
    const evidenceRepository = createEvidenceRepository(db.db);
    const researchReportRepository = createResearchReportRepository(db.db);
    const researchReportVerificationRepository = createResearchReportVerificationRepository(db.db);
    const createMission = createCreateMission(unitOfWork);
    const createBrowserProfile = createCreateBrowserProfile(unitOfWork);
    const disableBrowserProfile = createDisableBrowserProfile(unitOfWork);
    const decideApproval = createDecideApproval(unitOfWork);
    const createMemoryCandidate = createCreateMemoryCandidate(unitOfWork);
    const approveMemory = createApproveMemory(unitOfWork);
    const activateMemory = createActivateMemory(unitOfWork);
    const forgetMemory = createForgetMemory(unitOfWork);
    const captureOwnerEvidence = createCaptureOwnerEvidence(unitOfWork);
    const capturePublicEvidence = createCapturePublicEvidence(unitOfWork);
    const updateMissionContract = createUpdateMissionContract(unitOfWork);
    const confirmMissionContract = createConfirmMissionContract(unitOfWork);
    const planResearchMission = createPlanResearchMission(unitOfWork);

    const app = buildServer({
      logger,
      db,
      ownerId: `test-owner-${Date.now()}`,
      webOrigin: "http://localhost:3000",
      createMission,
      createBrowserProfile,
      disableBrowserProfile,
      decideApproval,
      createMemoryCandidate,
      approveMemory,
      activateMemory,
      forgetMemory,
      captureOwnerEvidence,
      capturePublicEvidence,
      updateMissionContract,
      confirmMissionContract,
      planResearchMission,
      missionRepository,
      approvalRepository,
      browserProfileRepository,
      memoryRepository,
      taskRepository,
      evidenceRepository,
      researchReportRepository,
      researchReportVerificationRepository,
      eventStore,
      eventBus,
    });

    return {
      app,
      async teardown() {
        await app.close();
        await eventBus.stop();
        await db.sql.end({ timeout: 1 });
      },
    };
  }

  it("создаёт и управляет owner memory только через явные lifecycle steps", async () => {
    const { app, teardown } = await setup();
    try {
      const created = await app.inject({
        method: "POST", url: "/memories", payload: {
          memoryType: "owner_preference", scope: "owner", subject: "language",
          content: "Предпочитает русский язык.", confidence: 0.9,
        },
      });
      expect(created.statusCode).toBe(201);
      const candidate = created.json().memory;
      expect(candidate.status).toBe("candidate");

      const approved = await app.inject({
        method: "POST", url: `/memories/${candidate.id}/approve`, payload: { expectedVersion: candidate.version },
      });
      expect(approved.statusCode).toBe(200);
      const active = await app.inject({
        method: "POST", url: `/memories/${candidate.id}/activate`, payload: { expectedVersion: approved.json().memory.version },
      });
      expect(active.statusCode).toBe(200);
      expect(active.json().memory.status).toBe("active");

      const forgotten = await app.inject({
        method: "POST", url: `/memories/${candidate.id}/forget`, payload: { expectedVersion: active.json().memory.version },
      });
      expect(forgotten.statusCode).toBe(200);
      const listed = await app.inject({ method: "GET", url: "/memories" });
      expect(listed.json().memories).toEqual([]);
      const includingForgotten = await app.inject({ method: "GET", url: "/memories?includeForgotten=true" });
      expect(includingForgotten.json().memories).toHaveLength(1);
    } finally {
      await teardown();
    }
  });

  it("POST /missions/:id/reports/:reportId/verify безопасно недоступен без strict verifier config", async () => {
    const { app, teardown } = await setup();
    try {
      const mission = await app.inject({ method: "POST", url: "/missions", payload: { rawRequest: "Исследуй рынок" } });
      const response = await app.inject({
        method: "POST",
        url: `/missions/${mission.json().mission.id as string}/reports/${randomUUID()}/verify`,
        payload: {},
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe("verifier_not_configured");
    } finally {
      await teardown();
    }
  });

  it("POST /missions/:id/reports/generate безопасно недоступен без server-side model config", async () => {
    const { app, teardown } = await setup();
    try {
      const mission = await app.inject({ method: "POST", url: "/missions", payload: { rawRequest: "Исследуй рынок" } });
      const response = await app.inject({
        method: "POST",
        url: `/missions/${mission.json().mission.id as string}/reports/generate`,
        payload: {},
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe("model_not_configured");
    } finally {
      await teardown();
    }
  });

  it("POST /missions отклоняет пустой или пробельный rawRequest", async () => {
    const { app, teardown } = await setup();
    try {
      for (const rawRequest of ["", "  \n\t "]) {
        const response = await app.inject({
          method: "POST",
          url: "/missions",
          payload: { rawRequest },
        });
        expect(response.statusCode).toBe(400);
      }
    } finally {
      await teardown();
    }
  });

  it("создаёт миссию, читает её обратно и видит событие MissionCreated", async () => {
    const { app, teardown } = await setup();
    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/missions",
        payload: { rawRequest: "Собери отчёт по продажам за неделю" },
      });
      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json();
      expect(created.mission.status).toBe("created");
      expect(created.mission.currentPhase).toBe("intake");
      const missionId = created.mission.id as string;

      const listResponse = await app.inject({ method: "GET", url: "/missions" });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().missions.some((m: { id: string }) => m.id === missionId)).toBe(
        true,
      );

      const getResponse = await app.inject({ method: "GET", url: `/missions/${missionId}` });
      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json().mission.id).toBe(missionId);

      const eventsResponse = await app.inject({
        method: "GET",
        url: `/missions/${missionId}/events`,
      });
      expect(eventsResponse.statusCode).toBe(200);
      const events = eventsResponse.json().events;
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("MissionCreated");

      const tasksResponse = await app.inject({
        method: "GET",
        url: `/missions/${missionId}/tasks`,
      });
      expect(tasksResponse.statusCode).toBe(200);
      expect(tasksResponse.json().tasks).toEqual([]);
    } finally {
      await teardown();
    }
  });

  it("сохраняет и подтверждает контракт без выполнения инструментов", async () => {
    const { app, teardown } = await setup();
    try {
      const created = await app.inject({
        method: "POST",
        url: "/missions",
        payload: { rawRequest: "Собери отчёт" },
      });
      const mission = created.json().mission;
      const updated = await app.inject({
        method: "PUT",
        url: `/missions/${mission.id}/contract`,
        payload: {
          expectedVersion: mission.version,
          objective: "Собрать еженедельный отчёт",
          autonomyLevel: "supervised",
          riskLevel: "L1",
          budget: mission.budget,
          successCriteria: ["Отчёт содержит выручку"],
          constraints: [], unknowns: [], assumptions: [], stopConditions: [],
        },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().mission.currentPhase).toBe("contract");
      const confirmed = await app.inject({
        method: "POST",
        url: `/missions/${mission.id}/contract/confirm`,
        payload: { expectedVersion: updated.json().mission.version },
      });
      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json().mission.status).toBe("understanding");
      const events = await app.inject({ method: "GET", url: `/missions/${mission.id}/events` });
      expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual([
        "MissionCreated", "MissionContractUpdated", "MissionContractConfirmed",
      ]);
    } finally {
      await teardown();
    }
  });

  it("управляет browser profile control-plane через owner-only API без запуска браузера", async () => {
    const { app, teardown } = await setup();
    try {
      const invalid = await app.inject({ method: "POST", url: "/browser/profiles", payload: { label: "x", mode: "unknown" } });
      expect(invalid.statusCode).toBe(400);

      const isolated = await app.inject({
        method: "POST", url: "/browser/profiles", payload: { label: "Research", mode: "agent_isolated" },
      });
      expect(isolated.statusCode).toBe(201);
      expect(isolated.json().profile).toMatchObject({ label: "Research", mode: "agent_isolated", status: "active", version: 1 });

      const shared = await app.inject({
        method: "POST", url: "/browser/profiles", payload: { label: "General", mode: "owner_shared" },
      });
      expect(shared.statusCode).toBe(201);

      const listed = await app.inject({ method: "GET", url: "/browser/profiles" });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().profiles.map((profile: { mode: string }) => profile.mode)).toEqual(["agent_isolated", "owner_shared"]);

      const disabled = await app.inject({
        method: "POST", url: `/browser/profiles/${isolated.json().profile.id}/disable`, payload: { expectedVersion: 1 },
      });
      expect(disabled.statusCode).toBe(200);
      expect(disabled.json().profile).toMatchObject({ status: "disabled", version: 2 });

      const stale = await app.inject({
        method: "POST", url: `/browser/profiles/${isolated.json().profile.id}/disable`, payload: { expectedVersion: 1 },
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().error).toBe("browser_profile_version_conflict");
    } finally {
      await teardown();
    }
  });

  it("GET /missions/:id отклоняет некорректный UUID до обращения к хранилищу", async () => {
    const { app, teardown } = await setup();
    try {
      const response = await app.inject({ method: "GET", url: "/missions/not-a-uuid" });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("invalid_path_params");
    } finally {
      await teardown();
    }
  });

  it("GET /missions/:id для несуществующей миссии возвращает 404", async () => {
    const { app, teardown } = await setup();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/missions/00000000-0000-0000-0000-000000000000",
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await teardown();
    }
  });
});
