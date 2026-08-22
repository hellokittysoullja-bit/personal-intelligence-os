import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Browser control-plane deliberately contains no Playwright, Chromium launch,
 * filesystem profile paths, cookies or credentials. It is a pure contract that
 * a future adapter must satisfy before it can observe or act in a session.
 */
export const browserProfileModeSchema = z.enum(["agent_isolated", "owner_shared"]);
export type BrowserProfileMode = z.infer<typeof browserProfileModeSchema>;

export const browserProfileStatusSchema = z.enum(["active", "disabled"]);
export type BrowserProfileStatus = z.infer<typeof browserProfileStatusSchema>;

export const browserSessionStatusSchema = z.enum(["paused", "active", "closed"]);
export type BrowserSessionStatus = z.infer<typeof browserSessionStatusSchema>;

export const browserControlOwnerSchema = z.enum(["agent", "human", "paused"]);
export type BrowserControlOwner = z.infer<typeof browserControlOwnerSchema>;

export const browserProfileSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  mode: browserProfileModeSchema,
  status: browserProfileStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BrowserProfile = z.infer<typeof browserProfileSchema>;

export const browserSessionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().trim().min(1),
  profileId: z.string().uuid(),
  status: browserSessionStatusSchema,
  controlOwner: browserControlOwnerSchema,
  reobservationRequired: z.boolean(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastObservedAt: z.string().datetime().nullable(),
});
export type BrowserSession = z.infer<typeof browserSessionSchema>;

export type BrowserRuntimeErrorCode =
  | "BROWSER_PROFILE_DISABLED"
  | "BROWSER_SESSION_CLOSED"
  | "BROWSER_CONTROL_NOT_HUMAN"
  | "BROWSER_CONTROL_NOT_AGENT"
  | "BROWSER_REOBSERVATION_REQUIRED";

export class BrowserRuntimeError extends Error {
  constructor(public readonly code: BrowserRuntimeErrorCode, message: string) {
    super(message);
    this.name = "BrowserRuntimeError";
  }
}

export function createBrowserProfile(input: {
  ownerId: string;
  label: string;
  mode: BrowserProfileMode;
  now?: string;
}): BrowserProfile {
  const now = input.now ?? new Date().toISOString();
  return browserProfileSchema.parse({
    id: randomUUID(),
    ownerId: input.ownerId,
    label: input.label,
    mode: input.mode,
    status: "active",
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Sessions always start paused. The isolated profile may be granted to the
 * agent, while a shared owner profile starts under human control. In both
 * cases an initial full observation is required before any future action.
 */
export function createBrowserSession(profile: BrowserProfile, now = new Date().toISOString()): BrowserSession {
  if (profile.status !== "active") {
    throw new BrowserRuntimeError("BROWSER_PROFILE_DISABLED", "Browser profile is disabled");
  }

  return browserSessionSchema.parse({
    id: randomUUID(),
    ownerId: profile.ownerId,
    profileId: profile.id,
    status: "paused",
    controlOwner: profile.mode === "owner_shared" ? "human" : "agent",
    reobservationRequired: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: null,
  });
}

export function requestHumanTakeover(session: BrowserSession, now = new Date().toISOString()): BrowserSession {
  assertSessionOpen(session);
  return { ...session, status: "paused", controlOwner: "human", reobservationRequired: true, version: session.version + 1, updatedAt: now };
}

/**
 * Only the owner can return a shared session to the agent. The next action
 * remains blocked until a new full observation has been recorded.
 */
export function returnControlToAgent(session: BrowserSession, now = new Date().toISOString()): BrowserSession {
  assertSessionOpen(session);
  if (session.controlOwner !== "human") {
    throw new BrowserRuntimeError("BROWSER_CONTROL_NOT_HUMAN", "Browser session is not under human control");
  }
  return { ...session, status: "paused", controlOwner: "agent", reobservationRequired: true, version: session.version + 1, updatedAt: now };
}

export function recordFullObservation(session: BrowserSession, now = new Date().toISOString()): BrowserSession {
  assertSessionOpen(session);
  if (session.controlOwner !== "agent") {
    throw new BrowserRuntimeError("BROWSER_CONTROL_NOT_AGENT", "Agent cannot observe while owner controls the browser session");
  }
  return { ...session, status: "active", reobservationRequired: false, lastObservedAt: now, version: session.version + 1, updatedAt: now };
}

/**
 * A future ToolExecutor must call this immediately before a browser action.
 * It intentionally cannot be bypassed by stale observations after takeover.
 */
export function assertBrowserActionReady(profile: BrowserProfile, session: BrowserSession): void {
  if (profile.status !== "active") {
    throw new BrowserRuntimeError("BROWSER_PROFILE_DISABLED", "Browser profile is disabled");
  }
  assertSessionOpen(session);
  if (session.controlOwner !== "agent") {
    throw new BrowserRuntimeError("BROWSER_CONTROL_NOT_AGENT", "Agent does not control the browser session");
  }
  if (session.status !== "active" || session.reobservationRequired) {
    throw new BrowserRuntimeError("BROWSER_REOBSERVATION_REQUIRED", "A new full browser observation is required before any action");
  }
}

export function closeBrowserSession(session: BrowserSession, now = new Date().toISOString()): BrowserSession {
  assertSessionOpen(session);
  return { ...session, status: "closed", controlOwner: "paused", reobservationRequired: true, version: session.version + 1, updatedAt: now };
}

/** Disabled profiles cannot create or resume future sessions. */
export function disableBrowserProfile(profile: BrowserProfile, now = new Date().toISOString()): BrowserProfile {
  if (profile.status === "disabled") return profile;
  return { ...profile, status: "disabled", version: profile.version + 1, updatedAt: now };
}

function assertSessionOpen(session: BrowserSession): void {
  if (session.status === "closed") {
    throw new BrowserRuntimeError("BROWSER_SESSION_CLOSED", "Browser session is closed");
  }
}
