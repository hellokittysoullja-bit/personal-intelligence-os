import type { BrowserContext } from "playwright";
import { createBrowserProfile } from "@pios/domain";
import { describe, expect, it } from "vitest";
import { BrowserRuntimeError, IsolatedPersistentBrowserLauncher, type PersistentContextLauncher } from "./persistent-launcher";

function profile(mode: "agent_isolated" | "owner_shared") {
  return createBrowserProfile({ ownerId: "owner-1", label: "Not used as path", mode, now: "2026-08-23T12:00:00.000Z" });
}

function fakeLauncher() {
  const calls: Array<{ directory: string; options: object }> = [];
  const routes: Array<{ pattern: string }> = [];
  const context = {
    async route(pattern: string) { routes.push({ pattern }); },
  } as unknown as BrowserContext;
  const launcher: PersistentContextLauncher = {
    async launchPersistentContext(directory, options) {
      calls.push({ directory, options });
      return context;
    },
  };
  return { calls, routes, launcher };
}

describe("IsolatedPersistentBrowserLauncher", () => {
  it("launches only a profile-id-derived isolated directory with conservative options", async () => {
    const { calls, routes, launcher } = fakeLauncher();
    const browserProfile = profile("agent_isolated");
    const runtime = new IsolatedPersistentBrowserLauncher({ profileRootDir: "/var/lib/pios/browser", headless: true }, launcher);

    await runtime.open(browserProfile);
    expect(calls).toEqual([{
      directory: `/var/lib/pios/browser/${browserProfile.id}`,
      options: { headless: true, acceptDownloads: false, chromiumSandbox: true, bypassCSP: false },
    }]);
    expect(calls[0]?.directory).not.toContain("Not used as path");
    expect(routes).toEqual([{ pattern: "**/*" }]);
  });

  it("rejects owner-shared profile without launching a browser", async () => {
    const { calls, launcher } = fakeLauncher();
    const runtime = new IsolatedPersistentBrowserLauncher({ profileRootDir: "/var/lib/pios/browser" }, launcher);

    await expect(runtime.open(profile("owner_shared"))).rejects.toMatchObject({ code: "BROWSER_SHARED_PROFILE_REQUIRES_HUMAN_TRANSPORT" });
    expect(calls).toHaveLength(0);
  });

  it("rejects disabled profile without launching a browser", async () => {
    const { calls, launcher } = fakeLauncher();
    const browserProfile = { ...profile("agent_isolated"), status: "disabled" as const };
    const runtime = new IsolatedPersistentBrowserLauncher({ profileRootDir: "/var/lib/pios/browser" }, launcher);

    await expect(runtime.open(browserProfile)).rejects.toBeInstanceOf(BrowserRuntimeError);
    expect(calls).toHaveLength(0);
  });
});
