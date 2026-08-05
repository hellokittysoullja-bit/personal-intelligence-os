import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Milestone 1 placeholder-таблица. Единственная цель — доказать, что
 * пайплайн Drizzle (generate → migrate → readiness check) работает целиком
 * end-to-end. Не несёт доменного смысла и не является частью доменной
 * модели (docs/DOMAIN_MODEL.md) — будет удалена, когда в Milestone 2
 * появятся реальные таблицы (goals, missions, tasks, mission_events).
 */
export const bootstrapCheck = pgTable("bootstrap_check", {
  id: serial("id").primaryKey(),
  note: text("note").notNull().default("personal-intelligence-os bootstrap"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
