import type { DurableJob, Evidence, MemoryRecord, MissionBudget, ResearchReport, ResearchReportVerification } from "@pios/domain";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** docs/DOMAIN_MODEL.md §1 */
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  rawRequest: text("raw_request").notNull(),
  inferredIntent: text("inferred_intent"),
  desiredOutcome: text("desired_outcome"),
  parentGoalId: uuid("parent_goal_id"),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** docs/DOMAIN_MODEL.md §2 */
export const missions = pgTable("missions", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull(),
  currentPhase: text("current_phase").notNull(),
  autonomyLevel: text("autonomy_level").notNull(),
  riskLevel: text("risk_level").notNull(),
  budget: jsonb("budget").notNull().$type<MissionBudget>(),
  successCriteria: jsonb("success_criteria").notNull().$type<string[]>(),
  constraints: jsonb("constraints").notNull().$type<string[]>(),
  unknowns: jsonb("unknowns").notNull().$type<string[]>(),
  assumptions: jsonb("assumptions").notNull().$type<string[]>(),
  stopConditions: jsonb("stop_conditions").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

/**
 * docs/DOMAIN_MODEL.md §4. В Milestone 2 задачи не создаются (нет
 * планировщика — появляется в Milestone 4), но таблица нужна уже сейчас:
 * GET /missions/:id/tasks должен отвечать реальным (пустым) списком, а не
 * заглушкой, и схема не должна требовать ломающей миграции в M4.
 */
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey(),
  missionId: uuid("mission_id")
    .notNull()
    .references(() => missions.id),
  parentTaskId: uuid("parent_task_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  taskType: text("task_type").notNull(),
  status: text("status").notNull(),
  dependencies: jsonb("dependencies").notNull().$type<string[]>(),
  // Ссылается на будущую таблицу agent_jobs (Milestone 6) — пока без FK,
  // т.к. таблицы ещё не существует.
  assignedAgentJobId: uuid("assigned_agent_job_id"),
  inputArtifactIds: jsonb("input_artifact_ids").notNull().$type<string[]>(),
  outputArtifactIds: jsonb("output_artifact_ids").notNull().$type<string[]>(),
  successCriteria: jsonb("success_criteria").notNull().$type<string[]>(),
  evidenceRequirements: jsonb("evidence_requirements").notNull().$type<string[]>(),
  maxAttempts: integer("max_attempts").notNull().default(3),
  attemptCount: integer("attempt_count").notNull().default(0),
  timeoutMs: integer("timeout_ms").notNull(),
  budget: jsonb("budget").notNull().$type<MissionBudget>(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Проверяемые фрагменты публичных read-only источников research mission. */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    provenance: jsonb("provenance").notNull().$type<Evidence["provenance"]>(),
    confidence: integer("confidence_basis_points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("evidence_mission_id_created_at_idx").on(table.missionId, table.createdAt)],
);

/** Durable worker control-plane: lease/heartbeat хранятся в БД и переживают рестарт процесса. */
export const durableJobs = pgTable(
  "durable_jobs",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    missionId: uuid("mission_id").references(() => missions.id),
    jobType: text("job_type").notNull(),
    payload: jsonb("payload").notNull().$type<DurableJob["payload"]>(),
    status: text("status").notNull(),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("durable_jobs_status_created_at_idx").on(table.status, table.createdAt)],
);

/**
 * Версионируемая owner memory. Содержимое не дублируется в mission_events,
 * поэтому forget исключает его из штатных retrieval-интерфейсов.
 */
export const memoryRecords = pgTable(
  "memory_records",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    memoryType: text("memory_type").notNull(),
    scope: text("scope").notNull(),
    subject: text("subject").notNull(),
    content: text("content").notNull(),
    structuredData: jsonb("structured_data").notNull().$type<MemoryRecord["structuredData"]>(),
    provenance: jsonb("provenance").notNull().$type<MemoryRecord["provenance"]>(),
    confidence: integer("confidence_basis_points").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: text("status").notNull(),
    supersedesId: uuid("supersedes_id"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memory_records_owner_status_updated_at_idx").on(table.ownerId, table.status, table.updatedAt),
    index("memory_records_owner_scope_subject_idx").on(table.ownerId, table.scope, table.subject),
    uniqueIndex("memory_records_one_active_subject_idx")
      .on(table.ownerId, table.scope, table.subject)
      .where(sql`${table.status} = 'active'`),
  ],
);

/** Версионируемые черновики отчётов, где все citation IDs указывают на evidence. */
export const researchReports = pgTable(
  "research_reports",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    status: text("status").notNull(),
    content: jsonb("content").notNull().$type<ResearchReport["content"]>(),
    citedEvidenceIds: jsonb("cited_evidence_ids").notNull().$type<string[]>(),
    model: jsonb("model").notNull().$type<ResearchReport["model"]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("research_reports_mission_id_created_at_idx").on(table.missionId, table.createdAt)],
);

/** Независимые verifier results; report draft не перезаписывается их исходом. */
export const researchReportVerifications = pgTable(
  "research_report_verifications",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => researchReports.id),
    verdict: text("verdict").notNull(),
    content: jsonb("content").notNull().$type<ResearchReportVerification["content"]>(),
    model: jsonb("model").notNull().$type<ResearchReportVerification["model"]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("research_report_verifications_report_id_created_at_idx").on(table.reportId, table.createdAt)],
);

/**
 * docs/DOMAIN_MODEL.md §12, ADR-004 — append-only журнал аудита, основной
 * источник объяснимости. Композитный индекс (mission_id, timestamp)
 * заложен сразу — см. риск партиционирования в docs/ARCHITECTURE.md §17.
 */
export const missionEvents = pgTable(
  "mission_events",
  {
    eventId: uuid("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    ownerId: text("owner_id").notNull(),
    missionId: uuid("mission_id"),
    taskId: uuid("task_id"),
    agentJobId: uuid("agent_job_id"),
    traceId: text("trace_id").notNull(),
    causationId: uuid("causation_id"),
    correlationId: text("correlation_id").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    schemaVersion: integer("schema_version").notNull(),
  },
  (table) => [index("mission_events_mission_id_timestamp_idx").on(table.missionId, table.timestamp)],
);
