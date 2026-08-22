import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // Единственный владелец системы (docs/SECURITY.md §11) — до появления
  // аутентификации все запросы обслуживаются от его имени.
  OWNER_ID: z.string().min(1).default("owner"),
  // Источник, которому разрешён CORS-доступ к API (apps/web).
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  // В production токен обязателен. Web-приложение передаёт его server-side через
  // прокси; он никогда не должен попадать в NEXT_PUBLIC_* переменные.
  API_AUTH_TOKEN: z.string().min(32).optional(),
  // Необязательный OpenAI-compatible gateway. Все три переменные должны быть
  // заданы вместе; секрет никогда не покидает server-side process.
  PIOS_MODEL_API_BASE: z.string().url().optional(),
  PIOS_MODEL_API_KEY: z.string().min(1).optional(),
  PIOS_MODEL_RESEARCH_LONG_CONTEXT: z.string().min(1).optional(),
  // Необязательная отдельная модель/capability для независимой verifier-проверки.
  PIOS_MODEL_VERIFICATION_STRICT: z.string().min(1).optional(),
  PIOS_MODEL_PROVIDER_ID: z.string().min(1).default("openai-compatible"),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && !env.API_AUTH_TOKEN) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["API_AUTH_TOKEN"],
      message: "API_AUTH_TOKEN is required in production",
    });
  }
  const modelFields = [env.PIOS_MODEL_API_BASE, env.PIOS_MODEL_API_KEY, env.PIOS_MODEL_RESEARCH_LONG_CONTEXT];
  if (modelFields.some(Boolean) && !modelFields.every(Boolean)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PIOS_MODEL_API_BASE"],
      message: "PIOS_MODEL_API_BASE, PIOS_MODEL_API_KEY and PIOS_MODEL_RESEARCH_LONG_CONTEXT must be set together",
    });
  }
  if (env.PIOS_MODEL_VERIFICATION_STRICT && !modelFields.every(Boolean)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PIOS_MODEL_VERIFICATION_STRICT"],
      message: "PIOS_MODEL_VERIFICATION_STRICT requires the complete model gateway configuration",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Приложение не стартует с невалидным/неполным конфигом (docs/DEVELOPMENT.md
 * §7). Ошибка печатается в stderr в понятном виде и процесс завершается —
 * никакого запуска "наполовину настроенным".
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    console.error("Invalid environment configuration for apps/api:");
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return parsed.data;
}
