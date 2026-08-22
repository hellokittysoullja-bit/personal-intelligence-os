import { createHash, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import {
  buildEvidenceDossier,
} from "@pios/application";
import type {
  CaptureOwnerEvidence,
  CreateBrowserProfile,
  DecideApproval,
  DisableBrowserProfile,
  CapturePublicEvidence,
  ConfirmMissionContract,
  CreateMemoryCandidate,
  ApproveMemory,
  ActivateMemory,
  ForgetMemory,
  GenerateResearchReport,
  CreateMission,
  PlanResearchMission,
  UpdateMissionContract,
  VerifyResearchReport,
} from "@pios/application";
import {
  approvalResponseSchema,
  browserProfileResponseSchema,
  createBrowserProfileRequestSchema,
  disableBrowserProfileRequestSchema,
  listBrowserProfilesResponseSchema,
  decideApprovalRequestSchema,
  listApprovalsResponseSchema,
  captureOwnerEvidenceRequestSchema,
  capturePublicEvidenceRequestSchema,
  captureOwnerEvidenceResponseSchema,
  createMemoryCandidateRequestSchema,
  confirmMissionContractRequestSchema,
  createMissionRequestSchema,
  createMissionResponseSchema,
  eventDtoSchema,
  generateResearchReportRequestSchema,
  generateResearchReportResponseSchema,
  listResearchReportVerificationsResponseSchema,
  getMissionResponseSchema,
  healthResponseSchema,
  listEventsResponseSchema,
  listEvidenceResponseSchema,
  listMissionsResponseSchema,
  listMemoriesResponseSchema,
  listResearchReportsResponseSchema,
  listTasksResponseSchema,
  memoryResponseSchema,
  memoryTransitionRequestSchema,
  planResearchMissionRequestSchema,
  updateMissionContractRequestSchema,
  verifyResearchReportRequestSchema,
  verifyResearchReportResponseSchema,
} from "@pios/contracts";
import { ModelGatewayError } from "@pios/model-gateway";
import {
  pingDatabase,
  type DatabaseClient,
  type EventBus,
} from "@pios/database";
import {
  DomainError,
  type ApprovalRepository,
  type BrowserProfileRepository,
  type EvidenceRepository,
  type EventStore,
  type MissionRepository,
  type MemoryRepository,
  type ResearchReportRepository,
  type ResearchReportVerificationRepository,
  type TaskRepository,
} from "@pios/domain";
import type { Logger } from "@pios/observability";
import Fastify from "fastify";
import { readPublicTextSource } from "@pios/source-reader";
import { z, ZodError } from "zod";

function cleanText(value: string, maxLength: number): string {
  return value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function titleFromSource(body: string, sourceUrl: string): string {
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return cleanText(title ?? new URL(sourceUrl).hostname, 500) || new URL(sourceUrl).hostname;
}

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
  createBrowserProfile: CreateBrowserProfile;
  disableBrowserProfile: DisableBrowserProfile;
  decideApproval: DecideApproval;
  createMemoryCandidate: CreateMemoryCandidate;
  approveMemory: ApproveMemory;
  activateMemory: ActivateMemory;
  forgetMemory: ForgetMemory;
  captureOwnerEvidence: CaptureOwnerEvidence;
  capturePublicEvidence: CapturePublicEvidence;
  updateMissionContract: UpdateMissionContract;
  confirmMissionContract: ConfirmMissionContract;
  planResearchMission: PlanResearchMission;
  generateResearchReport?: GenerateResearchReport;
  verifyResearchReport?: VerifyResearchReport;
  missionRepository: MissionRepository;
  approvalRepository: ApprovalRepository;
  browserProfileRepository: BrowserProfileRepository;
  memoryRepository: MemoryRepository;
  taskRepository: TaskRepository;
  evidenceRepository: EvidenceRepository;
  researchReportRepository: ResearchReportRepository;
  researchReportVerificationRepository: ResearchReportVerificationRepository;
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
  generateResearchReport,
  verifyResearchReport,
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
    const status = error.code.endsWith("_NOT_FOUND") ? 404 :
      error.code === "MISSION_CONTRACT_INCOMPLETE" || error.code === "RESEARCH_EVIDENCE_REQUIRED" || error.code === "MODEL_OUTPUT_INVALID" ? 422 : 409;
    reply.code(status);
    return { error: error.code.toLowerCase() };
  }

  app.get("/approvals", async () => {
    const approvals = await approvalRepository.listPendingByOwner(ownerId);
    return listApprovalsResponseSchema.parse({ approvals });
  });

  app.post("/approvals/:id/decision", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = decideApprovalRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    try {
      const { request: approval } = await decideApproval({
        approvalId: params.data.id,
        ownerId,
        decision: body.data.decision,
      });
      return approvalResponseSchema.parse({ approval });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.get("/browser/profiles", async () => {
    const profiles = await browserProfileRepository.listByOwner(ownerId);
    return listBrowserProfilesResponseSchema.parse({ profiles });
  });

  app.post("/browser/profiles", async (request, reply) => {
    const body = createBrowserProfileRequestSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    try {
      const { profile } = await createBrowserProfile({ ...body.data, ownerId });
      reply.code(201);
      return browserProfileResponseSchema.parse({ profile });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.post("/browser/profiles/:id/disable", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = disableBrowserProfileRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    try {
      const { profile } = await disableBrowserProfile({
        profileId: params.data.id,
        ownerId,
        expectedVersion: body.data.expectedVersion,
      });
      return browserProfileResponseSchema.parse({ profile });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.post("/memories", async (request, reply) => {
    const body = createMemoryCandidateRequestSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400);
      return { error: "invalid_request", details: body.error.flatten() };
    }
    try {
      const { memory } = await createMemoryCandidate({ ...body.data, ownerId });
      reply.code(201);
      return memoryResponseSchema.parse({ memory });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      throw error;
    }
  });

  app.get("/memories", async (request, reply) => {
    const query = z.object({ includeForgotten: z.enum(["true", "false"]).optional() }).safeParse(request.query);
    if (!query.success) {
      reply.code(400);
      return { error: "invalid_query", details: query.error.flatten() };
    }
    const memories = await memoryRepository.listByOwner(ownerId, {
      includeForgotten: query.data.includeForgotten === "true",
    });
    return listMemoriesResponseSchema.parse({ memories });
  });

  function memoryTransitionRoute(
    execute: (input: { memoryId: string; ownerId: string; expectedVersion: number }) => Promise<{ memory: unknown }>,
  ) {
    return async (request: { params: unknown; body: unknown }, reply: { code(statusCode: number): unknown }) => {
      const params = missionParamsSchema.safeParse(request.params);
      const body = memoryTransitionRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        reply.code(400);
        return { error: "invalid_request" };
      }
      try {
        const { memory } = await execute({ memoryId: params.data.id, ownerId, expectedVersion: body.data.expectedVersion });
        return memoryResponseSchema.parse({ memory });
      } catch (error) {
        const domainError = sendDomainError(error, reply);
        if (domainError) return domainError;
        throw error;
      }
    };
  }

  app.post("/memories/:id/approve", memoryTransitionRoute(approveMemory));
  app.post("/memories/:id/activate", memoryTransitionRoute(activateMemory));
  app.post("/memories/:id/forget", memoryTransitionRoute(forgetMemory));

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

  app.post("/missions/:id/reports/generate", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = generateResearchReportRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    if (!generateResearchReport) {
      reply.code(503);
      return { error: "model_not_configured" };
    }
    try {
      const { report } = await generateResearchReport({ missionId: params.data.id, ownerId });
      reply.code(201);
      return generateResearchReportResponseSchema.parse({ report });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      if (error instanceof ModelGatewayError) {
        reply.code(error.code === "configuration" ? 503 : 502);
        return { error: error.code === "configuration" ? "model_not_configured" : "model_generation_failed" };
      }
      throw error;
    }
  });

  app.get("/missions/:id/reports", async (request, reply) => {
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
    const reports = await researchReportRepository.listByMission(params.data.id);
    return listResearchReportsResponseSchema.parse({ reports });
  });

  app.post("/missions/:id/reports/:reportId/verify", async (request, reply) => {
    const params = z.object({ id: z.string().uuid(), reportId: z.string().uuid() }).safeParse(request.params);
    const body = verifyResearchReportRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    if (!verifyResearchReport) {
      reply.code(503);
      return { error: "verifier_not_configured" };
    }
    try {
      const { verification } = await verifyResearchReport({
        missionId: params.data.id,
        reportId: params.data.reportId,
        ownerId,
      });
      reply.code(201);
      return verifyResearchReportResponseSchema.parse({ verification });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      if (error instanceof ModelGatewayError) {
        reply.code(error.code === "configuration" ? 503 : 502);
        return { error: error.code === "configuration" ? "verifier_not_configured" : "verification_failed" };
      }
      throw error;
    }
  });

  app.get("/missions/:id/reports/:reportId/verifications", async (request, reply) => {
    const params = z.object({ id: z.string().uuid(), reportId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "invalid_path_params", details: params.error.flatten() };
    }
    const mission = await missionRepository.getById(params.data.id);
    const report = await researchReportRepository.getById(params.data.reportId);
    if (!mission || mission.ownerId !== ownerId || !report || report.missionId !== mission.id || report.ownerId !== ownerId) {
      reply.code(404);
      return { error: "report_not_found" };
    }
    const verifications = await researchReportVerificationRepository.listByReport(report.id);
    return listResearchReportVerificationsResponseSchema.parse({ verifications });
  });

  app.post("/missions/:id/evidence/fetch", async (request, reply) => {
    const params = missionParamsSchema.safeParse(request.params);
    const body = capturePublicEvidenceRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    try {
      const source = await readPublicTextSource(body.data.sourceUrl);
      const excerpt = cleanText(source.body, 8_000);
      if (!excerpt) {
        reply.code(422);
        return { error: "empty_text_source" };
      }
      const { evidence } = await capturePublicEvidence({
        missionId: params.data.id,
        ownerId,
        sourceUrl: source.finalUrl,
        title: titleFromSource(source.body, source.finalUrl),
        excerpt,
        contentType: source.contentType,
        retrievedAt: source.retrievedAt,
        contentHash: createHash("sha256").update(source.body).digest("hex"),
        confidence: 0.5,
      });
      reply.code(201);
      return captureOwnerEvidenceResponseSchema.parse({ evidence });
    } catch (error) {
      const domainError = sendDomainError(error, reply);
      if (domainError) return domainError;
      reply.code(422);
      return { error: "source_fetch_rejected" };
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
