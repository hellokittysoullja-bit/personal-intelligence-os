import {
  actionRiskLevelSchema,
  autonomyLevelSchema,
  missionBudgetSchema,
  missionSchema,
  type Mission,
} from "@pios/domain";
import { z } from "zod";

/**
 * Wire-контракты для Mission. Переиспользуют domain-схему как есть (она уже
 * полностью сериализуема) вместо дублирования полей — см.
 * docs/ARCHITECTURE.md §1.3 про роль packages/contracts.
 */
export const missionDtoSchema = missionSchema;
export type MissionDto = Mission;

export const createMissionRequestSchema = z.object({
  rawRequest: z.string().trim().min(1, "rawRequest is required").max(4000),
});
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;

const contractItemsSchema = z.array(z.string().trim().min(1).max(500)).max(20);

export const updateMissionContractRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  objective: z.string().trim().min(1).max(4000),
  autonomyLevel: autonomyLevelSchema,
  riskLevel: actionRiskLevelSchema,
  budget: missionBudgetSchema,
  successCriteria: contractItemsSchema,
  constraints: contractItemsSchema,
  unknowns: contractItemsSchema,
  assumptions: contractItemsSchema,
  stopConditions: contractItemsSchema,
});
export type UpdateMissionContractRequest = z.infer<typeof updateMissionContractRequestSchema>;

export const confirmMissionContractRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export type ConfirmMissionContractRequest = z.infer<typeof confirmMissionContractRequestSchema>;

export const planResearchMissionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export type PlanResearchMissionRequest = z.infer<typeof planResearchMissionRequestSchema>;

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
