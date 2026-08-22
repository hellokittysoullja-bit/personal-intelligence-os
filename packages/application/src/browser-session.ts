import {
  BrowserRuntimeError,
  closeBrowserSession,
  createBrowserSession,
  createBrowserSessionClosedEvent,
  createBrowserSessionControlReturnedEvent,
  createBrowserSessionHumanTakeoverEvent,
  createBrowserSessionObservedEvent,
  createBrowserSessionStartedEvent,
  DomainError,
  recordFullObservation,
  requestHumanTakeover,
  returnControlToAgent,
  type BrowserProfile,
  type BrowserSession,
  type UnitOfWork,
} from "@pios/domain";

export interface StartBrowserSessionInput {
  ownerId: string;
  profileId: string;
}

export interface BrowserSessionTransitionInput {
  ownerId: string;
  sessionId: string;
  expectedVersion: number;
}

function assertOwnedProfile(profile: BrowserProfile | null, ownerId: string): asserts profile is BrowserProfile {
  if (!profile || profile.ownerId !== ownerId) throw new DomainError("BROWSER_PROFILE_NOT_FOUND", "Browser profile not found");
}

function assertOwnedSession(session: BrowserSession | null, ownerId: string): asserts session is BrowserSession {
  if (!session || session.ownerId !== ownerId) throw new DomainError("BROWSER_SESSION_NOT_FOUND", "Browser session not found");
}

function assertExpectedVersion(session: BrowserSession, expectedVersion: number): void {
  if (session.version !== expectedVersion) {
    throw new DomainError("BROWSER_SESSION_VERSION_CONFLICT", "Browser session changed concurrently; reload before retrying");
  }
}

async function updateOrConflict(
  ctx: Parameters<UnitOfWork["run"]>[0] extends (ctx: infer Context) => Promise<unknown> ? Context : never,
  session: BrowserSession,
  expectedVersion: number,
): Promise<void> {
  if (!await ctx.browserSessions.update(session, expectedVersion)) {
    throw new DomainError("BROWSER_SESSION_VERSION_CONFLICT", "Browser session changed concurrently; reload before retrying");
  }
}

function translateBrowserError(error: unknown): never {
  if (error instanceof BrowserRuntimeError) {
    throw new DomainError("BROWSER_SESSION_INVALID_STATE", error.message);
  }
  throw error;
}

export function createStartBrowserSession(unitOfWork: UnitOfWork) {
  return async function startBrowserSession(input: StartBrowserSessionInput) {
    return unitOfWork.run(async (ctx) => {
      const profile = await ctx.browserProfiles.getById(input.profileId);
      assertOwnedProfile(profile, input.ownerId);
      let session: BrowserSession;
      try {
        session = createBrowserSession(profile);
      } catch (error) {
        translateBrowserError(error);
      }
      await ctx.browserSessions.create(session);
      const event = createBrowserSessionStartedEvent(session);
      await ctx.events.append(event);
      return { session, event };
    });
  };
}

export function createRequestBrowserHumanTakeover(unitOfWork: UnitOfWork) {
  return async function requestBrowserHumanTakeover(input: BrowserSessionTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.browserSessions.getById(input.sessionId);
      assertOwnedSession(current, input.ownerId);
      assertExpectedVersion(current, input.expectedVersion);
      let session: BrowserSession;
      try {
        session = requestHumanTakeover(current);
      } catch (error) {
        translateBrowserError(error);
      }
      await updateOrConflict(ctx, session, input.expectedVersion);
      const event = createBrowserSessionHumanTakeoverEvent(session);
      await ctx.events.append(event);
      return { session, event };
    });
  };
}

export function createReturnBrowserControlToAgent(unitOfWork: UnitOfWork) {
  return async function returnBrowserControl(input: BrowserSessionTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.browserSessions.getById(input.sessionId);
      assertOwnedSession(current, input.ownerId);
      assertExpectedVersion(current, input.expectedVersion);
      let session: BrowserSession;
      try {
        session = returnControlToAgent(current);
      } catch (error) {
        translateBrowserError(error);
      }
      await updateOrConflict(ctx, session, input.expectedVersion);
      const event = createBrowserSessionControlReturnedEvent(session);
      await ctx.events.append(event);
      return { session, event };
    });
  };
}

export function createRecordBrowserObservation(unitOfWork: UnitOfWork) {
  return async function recordBrowserObservation(input: BrowserSessionTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.browserSessions.getById(input.sessionId);
      assertOwnedSession(current, input.ownerId);
      assertExpectedVersion(current, input.expectedVersion);
      const profile = await ctx.browserProfiles.getById(current.profileId);
      assertOwnedProfile(profile, input.ownerId);
      let session: BrowserSession;
      try {
        session = recordFullObservation(current);
      } catch (error) {
        translateBrowserError(error);
      }
      await updateOrConflict(ctx, session, input.expectedVersion);
      const event = createBrowserSessionObservedEvent(session);
      await ctx.events.append(event);
      return { session, event };
    });
  };
}

export function createCloseBrowserSession(unitOfWork: UnitOfWork) {
  return async function closeSession(input: BrowserSessionTransitionInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.browserSessions.getById(input.sessionId);
      assertOwnedSession(current, input.ownerId);
      assertExpectedVersion(current, input.expectedVersion);
      let session: BrowserSession;
      try {
        session = closeBrowserSession(current);
      } catch (error) {
        translateBrowserError(error);
      }
      await updateOrConflict(ctx, session, input.expectedVersion);
      const event = createBrowserSessionClosedEvent(session);
      await ctx.events.append(event);
      return { session, event };
    });
  };
}

export type StartBrowserSession = ReturnType<typeof createStartBrowserSession>;
export type RequestBrowserHumanTakeover = ReturnType<typeof createRequestBrowserHumanTakeover>;
export type ReturnBrowserControlToAgent = ReturnType<typeof createReturnBrowserControlToAgent>;
export type RecordBrowserObservation = ReturnType<typeof createRecordBrowserObservation>;
export type CloseBrowserSession = ReturnType<typeof createCloseBrowserSession>;
