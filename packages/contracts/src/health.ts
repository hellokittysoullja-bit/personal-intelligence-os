import { z } from "zod";

/**
 * Wire-контракт ответа /health/live и /health/ready (см. docs/ARCHITECTURE.md
 * §1.3 про роль packages/contracts: сериализуемое подмножение для внешних
 * клиентов, отдельно от внутренних доменных схем).
 */
export const healthStatusSchema = z.enum(["ok", "degraded"]);

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string().min(1),
  time: z.string().datetime(),
  checks: z
    .record(z.string(), z.object({ ok: z.boolean(), message: z.string().optional() }))
    .optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
