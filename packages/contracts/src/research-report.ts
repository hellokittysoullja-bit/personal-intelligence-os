import { researchReportSchema } from "@pios/domain";
import { z } from "zod";

export const researchReportDtoSchema = researchReportSchema;
export type ResearchReportDto = z.infer<typeof researchReportDtoSchema>;

/** Пустое тело: разрешён только owner-triggered synthesis из уже сохранённого evidence. */
export const generateResearchReportRequestSchema = z.object({}).strict();
export type GenerateResearchReportRequest = z.infer<typeof generateResearchReportRequestSchema>;

export const generateResearchReportResponseSchema = z.object({ report: researchReportDtoSchema });
export type GenerateResearchReportResponse = z.infer<typeof generateResearchReportResponseSchema>;

export const listResearchReportsResponseSchema = z.object({ reports: z.array(researchReportDtoSchema) });
export type ListResearchReportsResponse = z.infer<typeof listResearchReportsResponseSchema>;
