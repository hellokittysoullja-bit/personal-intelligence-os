import {
  createBrowserProfile as newBrowserProfile,
  createBrowserProfileCreatedEvent,
  createBrowserProfileDisabledEvent,
  disableBrowserProfile,
  DomainError,
  type BrowserProfileMode,
  type UnitOfWork,
} from "@pios/domain";

export interface CreateBrowserProfileInput {
  ownerId: string;
  label: string;
  mode: BrowserProfileMode;
}

export interface DisableBrowserProfileInput {
  profileId: string;
  ownerId: string;
  expectedVersion: number;
}

export function createCreateBrowserProfile(unitOfWork: UnitOfWork) {
  return async function createBrowserProfile(input: CreateBrowserProfileInput) {
    return unitOfWork.run(async (ctx) => {
      const profile = newBrowserProfile({
        ownerId: input.ownerId,
        label: input.label,
        mode: input.mode,
      });
      await ctx.browserProfiles.create(profile);
      const event = createBrowserProfileCreatedEvent(profile);
      await ctx.events.append(event);
      return { profile, event };
    });
  };
}

export function createDisableBrowserProfile(unitOfWork: UnitOfWork) {
  return async function disableProfile(input: DisableBrowserProfileInput) {
    return unitOfWork.run(async (ctx) => {
      const current = await ctx.browserProfiles.getById(input.profileId);
      if (!current || current.ownerId !== input.ownerId) {
        throw new DomainError("BROWSER_PROFILE_NOT_FOUND", "Browser profile not found");
      }
      if (current.version !== input.expectedVersion) {
        throw new DomainError("BROWSER_PROFILE_VERSION_CONFLICT", "Browser profile changed concurrently; reload before retrying");
      }
      if (current.status !== "active") {
        throw new DomainError("BROWSER_PROFILE_INVALID_STATUS", "Browser profile is not active");
      }
      const profile = disableBrowserProfile(current);
      if (!await ctx.browserProfiles.update(profile, input.expectedVersion)) {
        throw new DomainError("BROWSER_PROFILE_VERSION_CONFLICT", "Browser profile changed concurrently; reload before retrying");
      }
      const event = createBrowserProfileDisabledEvent(profile);
      await ctx.events.append(event);
      return { profile, event };
    });
  };
}

export type CreateBrowserProfile = ReturnType<typeof createCreateBrowserProfile>;
export type DisableBrowserProfile = ReturnType<typeof createDisableBrowserProfile>;
