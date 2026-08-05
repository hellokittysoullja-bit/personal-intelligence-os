import { randomUUID } from "node:crypto";

/**
 * Идентификаторы сущностей — простые UUID-строки. Zod-схемы сущностей
 * (Goal, Mission, Task, Event) валидируют их как `z.string().uuid()`, а не
 * как номинальные Brand-типы: после сериализации в JSON (API-контракты,
 * mission_events.payload) бренд всё равно стирается, а внутри Milestone 2
 * не набралось достаточно мест, где перепутать MissionId и GoalId было бы
 * реальным риском. Brand<> (см. brand.ts) остаётся доступен для будущих
 * случаев, где это оправдано.
 */
export type OwnerId = string;
export type GoalId = string;
export type MissionId = string;
export type TaskId = string;
export type EventId = string;

export function newId(): string {
  return randomUUID();
}
