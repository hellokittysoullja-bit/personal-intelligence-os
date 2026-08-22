import { randomUUID } from "node:crypto";
import {
  createCaptureOwnerEvidence,
  createCapturePublicEvidence,
  createConfirmMissionContract,
  createCreateMission,
  createPlanResearchMission,
  createUpdateMissionContract,
} from "@pios/application";
import {
  createDatabaseClient,
  createEventBus,
  createEventStore,
  createEvidenceRepository,
  createMissionRepository,
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
    const taskRepository = createTaskRepository(db.db);
    const eventStore = createEventStore(db.db);
    const evidenceRepository = createEvidenceRepository(db.db);
    const researchReportRepository = createResearchReportRepository(db.db);
    const researchReportVerificationRepository = createResearchReportVerificationRepository(db.db);
    const createMission = createCreateMission(unitOfWork);
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
      captureOwnerEvidence,
      capturePublicEvidence,
      updateMissionContract,
      confirmMissionContract,
      planResearchMission,
      missionRepository,
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
