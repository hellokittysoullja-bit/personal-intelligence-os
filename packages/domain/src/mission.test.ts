import { describe, expect, it } from "vitest";
import { assertMissionTransition, canTransitionMission } from "./mission";
import { InvalidTransitionError } from "./errors";

describe("Mission status transitions", () => {
  it("разрешает документированные переходы", () => {
    expect(canTransitionMission("created", "understanding")).toBe(true);
    expect(canTransitionMission("understanding", "planning")).toBe(true);
    expect(canTransitionMission("understanding", "awaiting_clarification")).toBe(true);
    expect(canTransitionMission("awaiting_clarification", "understanding")).toBe(true);
    expect(canTransitionMission("verifying", "learning")).toBe(true);
    expect(canTransitionMission("learning", "completed")).toBe(true);
  });

  it("запрещает недокументированные переходы", () => {
    expect(canTransitionMission("created", "completed")).toBe(false);
    expect(canTransitionMission("completed", "executing")).toBe(false);
  });

  it("разрешает cancelled из любого нетерминального статуса", () => {
    expect(canTransitionMission("created", "cancelled")).toBe(true);
    expect(canTransitionMission("planning", "cancelled")).toBe(true);
    expect(canTransitionMission("awaiting_approval", "cancelled")).toBe(true);
  });

  it("запрещает cancelled из терминального статуса", () => {
    expect(canTransitionMission("completed", "cancelled")).toBe(false);
    expect(canTransitionMission("failed", "cancelled")).toBe(false);
    expect(canTransitionMission("cancelled", "cancelled")).toBe(false);
  });

  it("assertMissionTransition бросает InvalidTransitionError на недопустимом переходе", () => {
    expect(() => assertMissionTransition("created", "completed")).toThrow(
      InvalidTransitionError,
    );
  });

  it("assertMissionTransition не бросает на допустимом переходе", () => {
    expect(() => assertMissionTransition("created", "understanding")).not.toThrow();
  });
});
