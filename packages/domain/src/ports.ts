import type { DurableJob } from "./durable-job";
import type { Evidence } from "./evidence";
import type { DomainEvent } from "./event";
import type { Goal } from "./goal";
import type { Mission } from "./mission";
import type { MemoryRecord, MemoryScope } from "./memory";
import type { ResearchReport } from "./research-report";
import type { ResearchReportVerification } from "./research-report-verification";
import type { Task } from "./task";

/**
 * Доменные порты для персистентности (docs/ARCHITECTURE.md §1.1, §1.3).
 * Реализации живут в packages/database; domain и application видят только
 * эти интерфейсы.
 */
export interface GoalRepository {
  create(goal: Goal): Promise<void>;
  getById(id: string): Promise<Goal | null>;
}

export interface MissionRepository {
  create(mission: Mission): Promise<void>;
  getById(id: string): Promise<Mission | null>;
  list(ownerId: string): Promise<Mission[]>;
  /**
   * Атомарно обновляет Mission только при совпадении версии. Возвращает false,
   * если другой запрос уже изменил запись или её больше нет.
   */
  update(mission: Mission, expectedVersion: number): Promise<boolean>;
}

export interface TaskRepository {
  create(task: Task): Promise<void>;
  listByMission(missionId: string): Promise<Task[]>;
}

export interface EvidenceRepository {
  create(evidence: Evidence): Promise<void>;
  listByMission(missionId: string): Promise<Evidence[]>;
}

export interface DurableJobRepository {
  create(job: DurableJob): Promise<void>;
  listExpiredRunning(now: string): Promise<DurableJob[]>;
  update(job: DurableJob): Promise<boolean>;
}

export interface MemoryRepository {
  create(memory: MemoryRecord): Promise<void>;
  getById(memoryId: string): Promise<MemoryRecord | null>;
  update(memory: MemoryRecord, expectedVersion: number): Promise<boolean>;
  listByOwner(ownerId: string, options?: { includeForgotten?: boolean }): Promise<MemoryRecord[]>;
  listActiveByScopeAndSubject(ownerId: string, scope: MemoryScope, subject: string): Promise<MemoryRecord[]>;
}

export interface ResearchReportRepository {
  create(report: ResearchReport): Promise<void>;
  getById(reportId: string): Promise<ResearchReport | null>;
  listByMission(missionId: string): Promise<ResearchReport[]>;
}

export interface ResearchReportVerificationRepository {
  create(verification: ResearchReportVerification): Promise<void>;
  listByReport(reportId: string): Promise<ResearchReportVerification[]>;
}

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  listByMission(missionId: string): Promise<DomainEvent[]>;
  getById(eventId: string): Promise<DomainEvent | null>;
}

/**
 * Атомарная запись в несколько репозиториев одной транзакцией
 * (docs/decisions/ADR-004-event-based-audit-trail.md — состояние и событие
 * пишутся в одной транзакции). Контекст содержит только то, что реально
 * нужно use case'ам Milestone 2; расширяется по мере появления
 * многотабличных write-сценариев (Task, AgentJob и т.д.).
 */
export interface UnitOfWorkContext {
  goals: GoalRepository;
  missions: MissionRepository;
  tasks: TaskRepository;
  evidence: EvidenceRepository;
  durableJobs: DurableJobRepository;
  memories: MemoryRepository;
  reports: ResearchReportRepository;
  reportVerifications: ResearchReportVerificationRepository;
  events: EventStore;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}
