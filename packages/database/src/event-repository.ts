import type { DomainEvent, EventStore } from "@pios/domain";
import { asc, eq, sql } from "drizzle-orm";
import type { Executor } from "./client";
import { missionEvents } from "./schema";

function toDomain(row: typeof missionEvents.$inferSelect): DomainEvent {
  return {
    eventId: row.eventId,
    eventType: row.eventType,
    timestamp: row.timestamp.toISOString(),
    ownerId: row.ownerId,
    missionId: row.missionId,
    taskId: row.taskId,
    agentJobId: row.agentJobId,
    traceId: row.traceId,
    causationId: row.causationId,
    correlationId: row.correlationId,
    payload: row.payload,
    schemaVersion: row.schemaVersion,
  };
}

/**
 * Postgres обслуживает и хранение (mission_events), и транспорт realtime
 * (NOTIFY) — сознательное решение после аудита M0 (docs/ARCHITECTURE.md §3):
 * NOTIFY выполняется в той же транзакции, что и INSERT, поэтому реально
 * доставляется подписчикам только после коммита — гонок с "событие
 * разослано, но ещё не видно в БД" не возникает.
 */
export function createEventStore(executor: Executor): EventStore {
  return {
    async append(event) {
      await executor.insert(missionEvents).values({
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: new Date(event.timestamp),
        ownerId: event.ownerId,
        missionId: event.missionId,
        taskId: event.taskId,
        agentJobId: event.agentJobId,
        traceId: event.traceId,
        causationId: event.causationId,
        correlationId: event.correlationId,
        payload: event.payload,
        schemaVersion: event.schemaVersion,
      });

      if (event.missionId) {
        const notification = JSON.stringify({
          eventId: event.eventId,
          missionId: event.missionId,
        });
        await executor.execute(sql`select pg_notify('mission_events', ${notification})`);
      }
    },
    async listByMission(missionId) {
      const rows = await executor
        .select()
        .from(missionEvents)
        .where(eq(missionEvents.missionId, missionId))
        .orderBy(asc(missionEvents.timestamp));
      return rows.map(toDomain);
    },
    async getById(eventId) {
      const rows = await executor
        .select()
        .from(missionEvents)
        .where(eq(missionEvents.eventId, eventId))
        .limit(1);
      return rows[0] ? toDomain(rows[0]) : null;
    },
  };
}
