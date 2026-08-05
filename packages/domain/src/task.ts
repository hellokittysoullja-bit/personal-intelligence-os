import { z } from "zod";
import { InvalidTransitionError } from "./errors";
import { missionBudgetSchema } from "./mission";

/** docs/DOMAIN_MODEL.md §4 */
export const taskStatusSchema = z.enum([
  "pending",
  "ready",
  "running",
  "blocked",
  "awaiting_approval",
  "verifying",
  "completed",
  "rejected",
  "retrying",
  "failed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  parentTaskId: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string(),
  taskType: z.string().min(1),
  status: taskStatusSchema,
  dependencies: z.array(z.string().uuid()),
  assignedAgentJobId: z.string().uuid().nullable(),
  inputArtifactIds: z.array(z.string().uuid()),
  outputArtifactIds: z.array(z.string().uuid()),
  successCriteria: z.array(z.string()),
  evidenceRequirements: z.array(z.string()),
  maxAttempts: z.number().int().positive(),
  attemptCount: z.number().int().nonnegative(),
  timeoutMs: z.number().int().positive(),
  budget: missionBudgetSchema,
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof taskSchema>;

/** docs/DOMAIN_MODEL.md §4 — "cancelled" достижим из любого нетерминального статуса. */
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["ready"],
  ready: ["running"],
  running: ["blocked", "awaiting_approval", "verifying"],
  blocked: ["ready"],
  awaiting_approval: ["running", "rejected"],
  verifying: ["completed", "rejected"],
  rejected: ["retrying", "failed"],
  retrying: ["running"],
  completed: [],
  failed: [],
  cancelled: [],
};

const TASK_TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (to === "cancelled") {
    return !TASK_TERMINAL_STATUSES.has(from);
  }
  return TASK_TRANSITIONS[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new InvalidTransitionError("Task", from, to);
  }
}
