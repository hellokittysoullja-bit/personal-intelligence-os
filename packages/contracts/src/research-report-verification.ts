import { researchReportVerificationSchema } from "@pios/domain";
import { z } from "zod";

export const researchReportVerificationDtoSchema = researchReportVerificationSchema;
export type ResearchReportVerificationDto = z.infer<typeof researchReportVerificationDtoSchema>;

/** Пустое тело: проверка запускается владельцем для уже сохранённого report draft. */
export const verifyResearchReportRequestSchema = z.object({}).strict();
export type VerifyResearchReportRequest = z.infer<typeof verifyResearchReportRequestSchema>;

export const verifyResearchReportResponseSchema = z.object({ verification: researchReportVerificationDtoSchema });
export type VerifyResearchReportResponse = z.infer<typeof verifyResearchReportResponseSchema>;

export const listResearchReportVerificationsResponseSchema = z.object({
  verifications: z.array(researchReportVerificationDtoSchema),
});
export type ListResearchReportVerificationsResponse = z.infer<typeof listResearchReportVerificationsResponseSchema>;
