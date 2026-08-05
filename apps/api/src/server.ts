import cors from "@fastify/cors";
import type { CreateMission } from "@pios/application";
import {
  createMissionRequestSchema,
  createMissionResponseSchema,
  eventDtoSchema,
  getMissionResponseSchema,
  healthResponseSchema,
  listEventsResponseSchema,
  listMissionsResponseSchema,
  listTasksResponseSchema,
} from "@pios/contracts";
import {
  pingDatabase,
  type DatabaseClient,
  type EventBus,
} from "@pios/database";
import type { EventStore, MissionRepository, TaskRepository } from "@pios/domain";
import type { Logger } from "@pios/observability";
import Fastify from "fastify";
import { ZodError } from "zod";

export interface BuildServerOptions {
  logger: Logger;
  db: DatabaseClient;
  ownerId: string;
  webOrigin: string;
  createMission: CreateMission;
  missionRepository: MissionRepository;
  taskRepository: TaskRepository;
  eventStore: EventStore;
  eventBus: EventBus;
}

/**
 * /health/live — процесс жив, не проверяет зависимости.
 * /health/ready — процесс готов принимать нагрузку: проверяет Postgres
 * (docs/ARCHITECTURE.md §1.4).
 *
 * Возвращаемый тип намеренно не аннотирован явно как FastifyInstance —
 * Fastify({ loggerInstance }) инстанцирует generic-параметр логгера как
 * pino.Logger (а не дефолтный FastifyBaseLogger), поэтому тип должен быть
 * выведен, а не сужен обратно к несовместимому дефолту.
 */
export function buildServer({
  logger,
  db,
  ownerId,
  webOrigin,
  createMission,
  missionRepository,
  taskRepository,
  eventStore,
  eventBus,
}: BuildServerOptions) {
  const app = Fastify({ loggerInstance: logger });

  app.register(cors, { origin: webOrigin });

  app.get("/health/live", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      service: "api",
      time: new Date().toISOString(),
    });
  });

  app.get("/health/ready", async (_request, reply) => {
    const postgresOk = await pingDatabase(db.sql);
    const body = healthResponseSchema.parse({
      status: postgresOk ? "ok" : "degraded",
      service: "api",
      time: new Date().toISOString(),
      checks: {
        postgres: postgresOk
          ? { ok: true }
          : { ok: false, message: "Postgres unreachable" },
      },
    });
    reply.code(postgresOk ? 200 : 503);
    return body;
  });

  app.post("/missions", async (request, reply) => {
    let body: { rawRequest: string };
    try {
      body = createMissionRequestSchema.parse(request.body);
    } catch (error) {
      reply.code(400);
      return { error: "invalid_request", details: error instanceof ZodError ? error.flatten() : String(error) };
    }

    const { mission } = await createMission({ ownerId, rawRequest: body.rawRequest });
    reply.code(201);
    return createMissionResponseSchema.parse({ mission });
  });

  app.get("/missions", async () => {
    const missions = await missionRepository.list(ownerId);
    return listMissionsResponseSchema.parse({ missions });
  });

  app.get("/missions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mission = await missionRepository.getById(id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    return getMissionResponseSchema.parse({ mission });
  });

  app.get("/missions/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mission = await missionRepository.getById(id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const events = await eventStore.listByMission(id);
    return listEventsResponseSchema.parse({ events });
  });

  app.get("/missions/:id/tasks", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mission = await missionRepository.getById(id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const tasks = await taskRepository.listByMission(id);
    return listTasksResponseSchema.parse({ tasks });
  });

  /**
   * Realtime-таймлайн миссии через Server-Sent Events (решение зафиксировано
   * в Milestone 2 — docs/ARCHITECTURE.md §12: SSE выбран как более простой
   * вариант для однонаправленного потока событий, без необходимости в
   * WebSocket, пока нет клиент→сервер realtime-взаимодействия).
   */
  app.get("/missions/:id/events/stream", async (request, reply) => {
    const { id: missionId } = request.params as { id: string };
    const mission = await missionRepository.getById(missionId);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }

    // reply.hijack() отдаёт управление ответом нам напрямую, в обход
    // остального пайплайна Fastify — включая onSend-хук @fastify/cors,
    // который иначе добавляет Access-Control-Allow-Origin. Для SSE это
    // нужно сделать вручную, иначе браузер (другой origin — apps/web)
    // блокирует чтение потока политикой CORS.
    reply.hijack();
    const requestOrigin = request.headers.origin;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...(requestOrigin === webOrigin ? { "Access-Control-Allow-Origin": webOrigin } : {}),
    });
    reply.raw.write(": connected\n\n");

    const existing = await eventStore.listByMission(missionId);
    for (const event of existing) {
      reply.raw.write(`id: ${event.eventId}\ndata: ${JSON.stringify(eventDtoSchema.parse(event))}\n\n`);
    }

    const unsubscribe = eventBus.subscribe(missionId, (notification) => {
      void (async () => {
        const event = await eventStore.getById(notification.eventId);
        if (event) {
          reply.raw.write(`id: ${event.eventId}\ndata: ${JSON.stringify(eventDtoSchema.parse(event))}\n\n`);
        }
      })();
    });

    const keepAlive = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 20_000);

    request.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  return app;
}
