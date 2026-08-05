import { missionSchema, type Mission } from "@pios/domain";
import { z } from "zod";

/**
 * Wire-контракты для Mission. Переиспользуют domain-схему как есть (она уже
 * полностью сериализуема) вместо дублирования полей — см.
 * docs/ARCHITECTURE.md §1.3 про роль packages/contracts.
 */
export const missionDtoSchema = missionSchema;
export type MissionDto = Mission;

export const createMissionRequestSchema = z.object({
  rawRequest: z.string().min(1, "rawRequest is required").max(4000),
});
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;

export const createMissionResponseSchema = z.object({
  mission: missionDtoSchema,
});
export type CreateMissionResponse = z.infer<typeof createMissionResponseSchema>;

export const listMissionsResponseSchema = z.object({
  missions: z.array(missionDtoSchema),
});
export type ListMissionsResponse = z.infer<typeof listMissionsResponseSchema>;

export const getMissionResponseSchema = z.object({
  mission: missionDtoSchema,
});
export type GetMissionResponse = z.infer<typeof getMissionResponseSchema>;
