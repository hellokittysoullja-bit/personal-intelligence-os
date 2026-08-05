import { taskSchema, type Task } from "@pios/domain";
import { z } from "zod";

export const taskDtoSchema = taskSchema;
export type TaskDto = Task;

export const listTasksResponseSchema = z.object({
  tasks: z.array(taskDtoSchema),
});
export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;
