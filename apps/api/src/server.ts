import { timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import {
  buildEvidenceDossier,
} from "@pios/application";
import type {
  CaptureOwnerEvidence,
  ConfirmMissionContract,
  CreateMission,
  PlanResearchMission,
  UpdateMissionContract,
} from "@pios/application";
import {
  captureOwnerEvidenceRequestSchema,
  captureOwnerEvidenceResponseSchema,
  confirmMissionContractRequestSchema,
  createMissionRequestSchema,
  createMissionResponseSchema,
  eventDtoSchema,
  getMissionResponseSchema,
  healthResponseSchema,
  listEventsResponseSchema,
  listEvidenceResponseSchema,
  listMissionsResponseSchema,
  listTasksResponseSchema,
  planResearchMissionRequestSchema,
  updateMissionContractRequestSchema,
} from "@pios/contracts";
import {
  pingDatabase,
  type DatabaseClient,
  type EventBus,
} from "@pios/database";
import {
  DomainError,
  type EvidenceRepository,
  type EventStore,
  type MissionRepository,
  type TaskRepository,
} from "@pios/domain";
import type { Logger } from "@pios/observability";
import Fastify from "fastify";
import { z, ZodError } from "zod";

const missionParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface BuildServerOptions {
  logger: Logger;
  db: DatabaseClient;
  ownerId: string;
  webOrigin: string;
  authToken?: string;
  createMission: CreateMission;
  captureOwnerEvidence: CaptureOwnerEvidence;
  updateMissionContract: UpdateMissionContract;
  confirmMissionContract: ConfirmMissionContract;
  planResearchMission: PlanResearchMission;
  missionRepository: MissionRepository;
  taskRepository: TaskRepository;
  evidenceRepository: EvidenceRepository;
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
  authToken,
  createMission,
  captureOwnerEvidence,
  updateMissionContract,
  confirmMissionContract,
  planResearchMission,
  missionRepository,
  taskRepository,
  evidenceRepository,
  eventStore,
  eventBus,
}: BuildServerOptions) {
  const app = Fastify({ loggerInstance: logger });

  app.register(cors, { origin: webOrigin });

  app.addHook("onRequest", async (request, reply) => {
    if (!authToken || request.url.startsWith("/health/")) return;

    const expected = Buffer.from(`Bearer ${authToken}`);
    const received = Buffer.from(request.headers.authorization ?? "");
    const authorized =
      received.length === expected.length && timingSafeEqual(received, expected);

    if (!authorized) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

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

  function sendDomainError(error: unknown, reply: { code(statusCode: number): unknown }) {
    if (!(error instanceof DomainError)) return null;
    const status = error.code === "MISSION_NOT_FOUND" ? 404 :
      error.code === "MISSION_CONTRACT_INCOMPLETE" ? 422 : 409;
    reply.code(status);
    return { error: error.code.toLowerCase() };
  }

  app.put("/missions/:id/contract", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = updateMissionContractRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return {
        error: "invalid_request",
        details: { params: params.success ? undefined : params.error.flatten(), body: body.success ? undefined : body.error.flatten() },
      };
    }
    try {
      const { mission } = await updateMissionContract({ ...body.data, missionId: params.data.id, ownerId });
      return createMissionResponseSchema.parse({ mission });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.post("/missions/:id/contract/confirm", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = confirmMissionContractRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return {
        error: "invalid_request",
        details: { params: params.success ? undefined : params.error.flatten(), body: body.success ? undefined : body.error.flatten() },
      };
    }
    try {
      const { mission } = await confirmMissionContract({ ...body.data, missionId: params.data.id, ownerId });
      return createMissionResponseSchema.parse({ mission });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.post("/missions/:id/research/plan", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = planResearchMissionRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return {
        error: "invalid_request",
        details: { params: params.success ? undefined : params.error.flatten(), body: body.success ? undefined : body.error.flatten() },
      };
    }
    try {
      const { mission } = await planResearchMission({ ...body.data, missionId: params.data.id, ownerId });
      return createMissionResponseSchema.parse({ mission });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.post("/missions/:id/evidence", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = captureOwnerEvidenceRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    try {
      const { evidence } = await captureOwnerEvidence({ ...body.data, missionId: params.data.id, ownerId });
      reply.code(201);
      return captureOwnerEvidenceResponseSchema.parse({ evidence });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.get("/missions/:id/evidence/dossier", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    if (!mission || mission.ownerId !== ownerId) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const evidence = await evidenceRepository.listByMission(params.data.id);
    reply.type("text/markdown; charset=utf-8");
    return buildEvidenceDossier(mission, evidence);
  });

  app.get("/missions/:id/evidence", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    if (!mission || mission.ownerId !== ownerId) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const evidence = await evidenceRepository.listByMission(params.data.id);
    return listEvidenceResponseSchema.parse({ evidence });
  });

  app.get("/missions", async () => {
    const missions = await missionRepository.list(ownerId);
    return listMissionsResponseSchema.parse({ missions });
  });

  app.get("/missions/:id", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    return getMissionResponseSchema.parse({ mission });
  });

  app.get("/missions/:id/events", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const events = await eventStore.listByMission(params.data.id);
    return listEventsResponseSchema.parse({ events });
  });

  app.get("/missions/:id/tasks", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    if (!mission) {
      reply.code(404);
      return { error: "mission_not_found" };
    }
    const tasks = await taskRepository.listByMission(params.data.id);
    return listTasksResponseSchema.parse({ tasks });
  });

  /**
   * Realtime-таймлайн миссии через Server-Sent Events (решение зафиксировано
   * в Milestone 2 — docs/ARCHITECTURE.md §12: SSE выбран как более простой
   * вариант для однонаправленного потока событий, без необходимости в
   * WebSocket, пока нет клиент→сервер realtime-взаимодействия).
   */
  app.get("/missions/:id/events/stream", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const missionId = params.data.id;
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
