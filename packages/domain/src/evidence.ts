import { z } from "zod";

/**
 * Проверяемый фрагмент источника для research mission. Содержимое источника —
 * данные, а не инструкции для оркестратора или tools.
 */
export const evidenceSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  missionId: z.string().uuid(),
  sourceUrl: z.string().url().max(2_000),
  title: z.string().min(1).max(500),
  excerpt: z.string().min(1).max(8_000),
  retrievedAt: z.string().datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z.object({
    collector: z.enum(["owner_provided", "http_read_only"]),
    contentType: z.string().max(200),
  }),
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
