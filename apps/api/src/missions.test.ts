import { createCreateMission } from "@pios/application";
import {
  createDatabaseClient,
  createEventBus,
  createEventStore,
  createMissionRepository,
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
    const createMission = createCreateMission(unitOfWork);

    const app = buildServer({
      logger,
      db,
      ownerId: `test-owner-${Date.now()}`,
      webOrigin: "http://localhost:3000",
      createMission,
      missionRepository,
      taskRepository,
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

  it("POST /missions отклоняет пустой rawRequest", async () => {
    const { app, teardown } = await setup();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/missions",
        payload: { rawRequest: "" },
      });
      expect(response.statusCode).toBe(400);
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
