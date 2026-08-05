import { EventEmitter } from "node:events";
import type postgres from "postgres";

export interface MissionEventNotification {
  eventId: string;
  missionId: string;
}

export interface EventBus {
  /** Открывает LISTEN-соединение. Вызывается один раз при старте процесса. */
  start(): Promise<void>;
  /** Закрывает LISTEN-соединение (graceful shutdown). */
  stop(): Promise<void>;
  /** Подписка на уведомления по конкретной миссии; возвращает функцию отписки. */
  subscribe(missionId: string, handler: (n: MissionEventNotification) => void): () => void;
}

/**
 * Реализация EventBus поверх Postgres LISTEN/NOTIFY (docs/ARCHITECTURE.md §3,
 * исправлено после аудита M0 — единственный транспорт, реально работающий
 * между процессами api/worker без дополнительной инфраструктуры). Внутри
 * одного процесса уведомления дополнительно рассылаются через in-process
 * EventEmitter нескольким SSE-подписчикам — это деталь реализации fan-out
 * внутри процесса, а не замена межпроцессного транспорта.
 */
export function createEventBus(sql: postgres.Sql): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  let unlisten: (() => Promise<void>) | null = null;

  return {
    async start() {
      const { unlisten: stop } = await sql.listen("mission_events", (payload) => {
        try {
          const notification = JSON.parse(payload) as MissionEventNotification;
          emitter.emit(notification.missionId, notification);
        } catch {
          // Игнорируем некорректный payload — не должно происходить, т.к.
          // единственный источник NOTIFY — createEventStore в этом же пакете.
        }
      });
      unlisten = stop;
    },
    async stop() {
      if (unlisten) {
        await unlisten();
        unlisten = null;
      }
    },
    subscribe(missionId, handler) {
      emitter.on(missionId, handler);
      return () => emitter.off(missionId, handler);
    },
  };
}
