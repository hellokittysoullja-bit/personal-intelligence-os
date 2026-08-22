import { browserProfileModeSchema, browserProfileSchema } from "@pios/domain";
import type { BrowserProfileMode } from "@pios/domain";
import { z } from "zod";

export const browserProfileDtoSchema = browserProfileSchema;
export type BrowserProfileDto = z.infer<typeof browserProfileDtoSchema>;
export type { BrowserProfileMode };

export const createBrowserProfileRequestSchema = z.object({
  label: z.string().trim().min(1).max(120),
  mode: browserProfileModeSchema,
}).strict();
export type CreateBrowserProfileRequest = z.infer<typeof createBrowserProfileRequestSchema>;

export const disableBrowserProfileRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
export type DisableBrowserProfileRequest = z.infer<typeof disableBrowserProfileRequestSchema>;

export const browserProfileResponseSchema = z.object({ profile: browserProfileDtoSchema });
export type BrowserProfileResponse = z.infer<typeof browserProfileResponseSchema>;

export const listBrowserProfilesResponseSchema = z.object({ profiles: z.array(browserProfileDtoSchema) });
export type ListBrowserProfilesResponse = z.infer<typeof listBrowserProfilesResponseSchema>;
