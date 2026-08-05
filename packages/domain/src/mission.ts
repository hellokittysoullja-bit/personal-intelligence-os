import { z } from "zod";
import { InvalidTransitionError } from "./errors";
import { actionRiskLevelSchema } from "./risk";

/** docs/DOMAIN_MODEL.md §2 */
export const missionStatusSchema = z.enum([
  "created",
  "understanding",
  "awaiting_clarification",
  "planning",
  "executing",
  "verifying",
  "correcting",
  "awaiting_approval",
  "learning",
  "completed",
  "failed",
  "cancelled",
]);
export type MissionStatus = z.infer<typeof missionStatusSchema>;

/**
 * Грубая фаза когнитивного цикла (docs/ARCHITECTURE.md §4). В Milestone 2
 * миссия не продвигается дальше "intake" — реальный цикл появляется в
 * Milestone 4. Поле уже присутствует в схеме, чтобы не требовать
 * ломающей миграции позже.
 */
export const missionPhaseSchema = z.enum([
  "intake",
  "understand",
  "contract",
  "plan",
  "execute",
  "verify",
  "correct",
  "learn",
  "finish",
]);
export type MissionPhase = z.infer<typeof missionPhaseSchema>;

export const autonomyLevelSchema = z.enum(["manual", "supervised", "autonomous"]);
export type AutonomyLevel = z.infer<typeof autonomyLevelSchema>;

/**
 * Обязательные лимиты миссии (docs/DOMAIN_MODEL.md §2, ADR-009). Ни одна
 * Mission не существует без budget — превышение любого лимита является
 * управляемой остановкой, а не бесконечным циклом.
 */
export const missionBudgetSchema = z.object({
  maxModelCalls: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxDurationMs: z.number().int().positive(),
  maxEstimatedCostUsd: z.number().positive(),
  maxCorrectionLoops: z.number().int().nonnegative(),
  maxConcurrentAgentJobs: z.number().int().positive(),
  maxAgentJobDepth: z.number().int().nonnegative(),
});
export type MissionBudget = z.infer<typeof missionBudgetSchema>;

/** Разумные значения по умолчанию — TODO(M3): сделать настраиваемыми через MissionContract. */
export const DEFAULT_MISSION_BUDGET: MissionBudget = {
  maxModelCalls: 50,
  maxToolCalls: 100,
  maxDurationMs: 30 * 60 * 1000,
  maxEstimatedCostUsd: 5,
  maxCorrectionLoops: 3,
  maxConcurrentAgentJobs: 3,
  maxAgentJobDepth: 2,
};

export const missionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  goalId: z.string().uuid(),
  title: z.string().min(1),
  objective: z.string().min(1),
  status: missionStatusSchema,
  currentPhase: missionPhaseSchema,
  autonomyLevel: autonomyLevelSchema,
  riskLevel: actionRiskLevelSchema,
  budget: missionBudgetSchema,
  successCriteria: z.array(z.string()),
  constraints: z.array(z.string()),
  unknowns: z.array(z.string()),
  assumptions: z.array(z.string()),
  stopConditions: z.array(z.string()),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  version: z.number().int().nonnegative(),
});
export type Mission = z.infer<typeof missionSchema>;

/**
 * Допустимые переходы (docs/DOMAIN_MODEL.md §2). "cancelled" достижим из
 * любого нетерминального статуса — обрабатывается отдельно в
 * assertMissionTransition, а не дублируется в каждой строке таблицы.
 */
const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  created: ["understanding"],
  understanding: ["awaiting_clarification", "planning"],
  awaiting_clarification: ["understanding"],
  planning: ["executing", "awaiting_approval"],
  executing: ["verifying", "awaiting_approval", "correcting"],
  verifying: ["correcting", "learning", "failed"],
  correcting: ["executing", "failed"],
  awaiting_approval: ["planning", "executing", "verifying", "cancelled"],
  learning: ["completed"],
  completed: [],
  failed: [],
  cancelled: [],
};

const MISSION_TERMINAL_STATUSES: ReadonlySet<MissionStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  if (to === "cancelled") {
    return !MISSION_TERMINAL_STATUSES.has(from);
  }
  return MISSION_TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) {
    throw new InvalidTransitionError("Mission", from, to);
  }
}
