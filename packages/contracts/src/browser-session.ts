import { browserSessionSchema } from "@pios/domain";
import { z } from "zod";

export const browserSessionDtoSchema = browserSessionSchema;
export type BrowserSessionDto = z.infer<typeof browserSessionDtoSchema>;

export const browserSessionTransitionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
export type BrowserSessionTransitionRequest = z.infer<typeof browserSessionTransitionRequestSchema>;

export const browserSessionResponseSchema = z.object({ session: browserSessionDtoSchema });
export type BrowserSessionResponse = z.infer<typeof browserSessionResponseSchema>;

export const listBrowserSessionsResponseSchema = z.object({ sessions: z.array(browserSessionDtoSchema) });
export type ListBrowserSessionsResponse = z.infer<typeof listBrowserSessionsResponseSchema>;
