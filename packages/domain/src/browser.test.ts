import { describe, expect, it } from "vitest";
import {
  BrowserRuntimeError,
  assertBrowserActionReady,
  createBrowserProfile,
  createBrowserSession,
  disableBrowserProfile,
  recordFullObservation,
  requestHumanTakeover,
  returnControlToAgent,
} from "./browser";

const NOW = "2026-08-23T12:00:00.000Z";

function isolatedProfile() {
  return createBrowserProfile({ ownerId: "owner-1", label: "Research profile", mode: "agent_isolated", now: NOW });
}

function capturedRuntimeError(run: () => unknown): BrowserRuntimeError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BrowserRuntimeError);
    return error as BrowserRuntimeError;
  }
  throw new Error("Expected BrowserRuntimeError");
}

describe("browser profile control plane", () => {
  it("starts an isolated profile paused and blocks actions until a full observation", () => {
    const profile = isolatedProfile();
    const session = createBrowserSession(profile, NOW);

    expect(session).toMatchObject({ status: "paused", controlOwner: "agent", reobservationRequired: true, version: 1 });
    expect(() => assertBrowserActionReady(profile, session)).toThrow(BrowserRuntimeError);

    const observed = recordFullObservation(session, "2026-08-23T12:01:00.000Z");
    expect(observed).toMatchObject({ status: "active", controlOwner: "agent", reobservationRequired: false, version: 2 });
    expect(() => assertBrowserActionReady(profile, observed)).not.toThrow();
  });

  it("starts an owner-shared profile under human control", () => {
    const profile = createBrowserProfile({ ownerId: "owner-1", label: "General browser", mode: "owner_shared", now: NOW });
    const session = createBrowserSession(profile, NOW);

    expect(session).toMatchObject({ status: "paused", controlOwner: "human", reobservationRequired: true });
    expect(capturedRuntimeError(() => recordFullObservation(session, NOW)).code).toBe("BROWSER_CONTROL_NOT_AGENT");
  });

  it("forces full re-observation after human takeover before any future action", () => {
    const profile = isolatedProfile();
    const ready = recordFullObservation(createBrowserSession(profile, NOW), "2026-08-23T12:01:00.000Z");
    const human = requestHumanTakeover(ready, "2026-08-23T12:02:00.000Z");
    const returned = returnControlToAgent(human, "2026-08-23T12:03:00.000Z");

    expect(returned).toMatchObject({ status: "paused", controlOwner: "agent", reobservationRequired: true, version: 4 });
    expect(capturedRuntimeError(() => assertBrowserActionReady(profile, returned)).code).toBe("BROWSER_REOBSERVATION_REQUIRED");
    expect(() => assertBrowserActionReady(profile, recordFullObservation(returned, "2026-08-23T12:04:00.000Z"))).not.toThrow();
  });

  it("never lets the agent return control without a prior human takeover", () => {
    const session = createBrowserSession(isolatedProfile(), NOW);
    expect(capturedRuntimeError(() => returnControlToAgent(session, NOW)).code).toBe("BROWSER_CONTROL_NOT_HUMAN");
  });

  it("disables a profile versionedly and rejects new sessions", () => {
    const profile = disableBrowserProfile(isolatedProfile(), "2026-08-23T12:01:00.000Z");
    expect(profile).toMatchObject({ status: "disabled", version: 2 });
    expect(capturedRuntimeError(() => createBrowserSession(profile, NOW)).code).toBe("BROWSER_PROFILE_DISABLED");
  });
});
