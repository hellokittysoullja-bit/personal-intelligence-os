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
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && !env.API_AUTH_TOKEN) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["API_AUTH_TOKEN"],
      message: "API_AUTH_TOKEN is required in production",
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
