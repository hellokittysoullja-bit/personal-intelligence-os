import type {
  BrowserProfile,
  BrowserProfileRepository,
  BrowserSession,
  BrowserSessionRepository,
} from "@pios/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "./client";
import { browserProfiles, browserSessions } from "./schema";

function profileToDomain(row: typeof browserProfiles.$inferSelect): BrowserProfile {
  return {
    id: row.id,
    ownerId: row.ownerId,
    label: row.label,
    mode: row.mode as BrowserProfile["mode"],
    status: row.status as BrowserProfile["status"],
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sessionToDomain(row: typeof browserSessions.$inferSelect): BrowserSession {
  return {
    id: row.id,
    ownerId: row.ownerId,
    profileId: row.profileId,
    status: row.status as BrowserSession["status"],
    controlOwner: row.controlOwner as BrowserSession["controlOwner"],
    reobservationRequired: row.reobservationRequired,
    version: row.version,
    lastObservedAt: row.lastObservedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createBrowserProfileRepository(executor: Executor): BrowserProfileRepository {
  return {
    async create(profile) {
      await executor.insert(browserProfiles).values({
        ...profile,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      });
    },
    async getById(profileId) {
      const rows = await executor.select().from(browserProfiles).where(eq(browserProfiles.id, profileId));
      return rows[0] ? profileToDomain(rows[0]) : null;
    },
    async listByOwner(ownerId) {
      const rows = await executor.select().from(browserProfiles)
        .where(eq(browserProfiles.ownerId, ownerId)).orderBy(asc(browserProfiles.createdAt));
      return rows.map(profileToDomain);
    },
    async update(profile, expectedVersion) {
      const changed = await executor.update(browserProfiles).set({
        status: profile.status,
        version: profile.version,
        updatedAt: new Date(profile.updatedAt),
      }).where(and(eq(browserProfiles.id, profile.id), eq(browserProfiles.version, expectedVersion)))
        .returning({ id: browserProfiles.id });
      return changed.length === 1;
    },
  };
}

export function createBrowserSessionRepository(executor: Executor): BrowserSessionRepository {
  return {
    async create(session) {
      await executor.insert(browserSessions).values({
        ...session,
        lastObservedAt: session.lastObservedAt ? new Date(session.lastObservedAt) : null,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      });
    },
    async getById(sessionId) {
      const rows = await executor.select().from(browserSessions).where(eq(browserSessions.id, sessionId));
      return rows[0] ? sessionToDomain(rows[0]) : null;
    },
    async listByOwner(ownerId) {
      const rows = await executor.select().from(browserSessions)
        .where(eq(browserSessions.ownerId, ownerId)).orderBy(asc(browserSessions.createdAt));
      return rows.map(sessionToDomain);
    },
    async update(session, expectedVersion) {
      const changed = await executor.update(browserSessions).set({
        status: session.status,
        controlOwner: session.controlOwner,
        reobservationRequired: session.reobservationRequired,
        version: session.version,
        lastObservedAt: session.lastObservedAt ? new Date(session.lastObservedAt) : null,
        updatedAt: new Date(session.updatedAt),
      }).where(and(eq(browserSessions.id, session.id), eq(browserSessions.version, expectedVersion)))
        .returning({ id: browserSessions.id });
      return changed.length === 1;
    },
  };
}
