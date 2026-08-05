import { z } from "zod";

/**
 * Уровни риска действий L0-L4 (docs/SECURITY.md §2, docs/DOMAIN_MODEL.md §13).
 * Один enum, переиспользуемый Mission.riskLevel, Tool.riskLevel и решениями
 * PolicyEngine — чтобы не рассинхронизировать несколько параллельных
 * классификаций риска.
 */
export const actionRiskLevelSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export type ActionRiskLevel = z.infer<typeof actionRiskLevelSchema>;
