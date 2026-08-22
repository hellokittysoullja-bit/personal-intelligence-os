import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { type BrowserProfile } from "@pios/domain";
import { assertSafePublicUrl } from "@pios/source-reader";
import { z } from "zod";

export const browserRuntimeConfigSchema = z.object({
  profileRootDir: z.string().trim().min(1),
  headless: z.boolean().default(true),
}).strict();
export type BrowserRuntimeConfig = z.infer<typeof browserRuntimeConfigSchema>;
export type BrowserRuntimeConfigInput = z.input<typeof browserRuntimeConfigSchema>;

export type BrowserRuntimeErrorCode =
  | "BROWSER_PROFILE_DISABLED"
  | "BROWSER_SHARED_PROFILE_REQUIRES_HUMAN_TRANSPORT"
  | "BROWSER_PROFILE_ROOT_INVALID";

export class BrowserRuntimeError extends Error {
  constructor(public readonly code: BrowserRuntimeErrorCode, message: string) {
    super(message);
    this.name = "BrowserRuntimeError";
  }
}

export interface PersistentContextLauncher {
  launchPersistentContext(userDataDir: string, options: {
    headless: boolean;
    acceptDownloads: boolean;
    chromiumSandbox: boolean;
    bypassCSP: boolean;
  }): Promise<BrowserContext>;
}

/**
 * Opens only a PIOS-owned, profile-id-derived directory. The launcher does not
 * navigate, observe pages, upload data or expose page actions. Those must be
 * supplied later as ToolDefinitions through ToolExecutor.
 */
export class IsolatedPersistentBrowserLauncher {
  private readonly config: BrowserRuntimeConfig;

  constructor(
    config: BrowserRuntimeConfigInput,
    private readonly launcher: PersistentContextLauncher = chromium,
  ) {
    this.config = browserRuntimeConfigSchema.parse(config);
  }

  profileDirectory(profile: BrowserProfile): string {
    const root = path.resolve(this.config.profileRootDir);
    if (!path.isAbsolute(root)) {
      throw new BrowserRuntimeError("BROWSER_PROFILE_ROOT_INVALID", "Browser profile root must resolve to an absolute path");
    }
    const directory = path.resolve(root, profile.id);
    if (!directory.startsWith(`${root}${path.sep}`)) {
      throw new BrowserRuntimeError("BROWSER_PROFILE_ROOT_INVALID", "Browser profile directory escapes configured root");
    }
    return directory;
  }

  async open(profile: BrowserProfile): Promise<BrowserContext> {
    if (profile.status !== "active") {
      throw new BrowserRuntimeError("BROWSER_PROFILE_DISABLED", "Browser profile is disabled");
    }
    if (profile.mode !== "agent_isolated") {
      throw new BrowserRuntimeError(
        "BROWSER_SHARED_PROFILE_REQUIRES_HUMAN_TRANSPORT",
        "Owner-shared profiles require a dedicated human takeover transport and cannot be launched automatically",
      );
    }
    const context = await this.launcher.launchPersistentContext(this.profileDirectory(profile), {
      headless: this.config.headless,
      acceptDownloads: false,
      chromiumSandbox: true,
      bypassCSP: false,
    });
    await context.route("**/*", async (route) => {
      try {
        await assertSafePublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    return context;
  }
}
