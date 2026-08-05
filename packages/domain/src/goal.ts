import { z } from "zod";

/** docs/DOMAIN_MODEL.md §1 */
export const goalPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export type GoalPriority = z.infer<typeof goalPrioritySchema>;

export const goalStatusSchema = z.enum([
  "new",
  "interpreted",
  "converted_to_mission",
  "archived",
]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  rawRequest: z.string().min(1),
  inferredIntent: z.string().nullable(),
  desiredOutcome: z.string().nullable(),
  parentGoalId: z.string().uuid().nullable(),
  priority: goalPrioritySchema,
  status: goalStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Goal = z.infer<typeof goalSchema>;
