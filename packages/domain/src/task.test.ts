import { describe, expect, it } from "vitest";
import { assertTaskTransition, canTransitionTask } from "./task";
import { InvalidTransitionError } from "./errors";

describe("Task status transitions", () => {
  it("разрешает документированный happy path", () => {
    expect(canTransitionTask("pending", "ready")).toBe(true);
    expect(canTransitionTask("ready", "running")).toBe(true);
    expect(canTransitionTask("running", "verifying")).toBe(true);
    expect(canTransitionTask("verifying", "completed")).toBe(true);
  });

  it("разрешает цикл коррекции", () => {
    expect(canTransitionTask("verifying", "rejected")).toBe(true);
    expect(canTransitionTask("rejected", "retrying")).toBe(true);
    expect(canTransitionTask("retrying", "running")).toBe(true);
    expect(canTransitionTask("rejected", "failed")).toBe(true);
  });

  it("запрещает недокументированные переходы", () => {
    expect(canTransitionTask("pending", "completed")).toBe(false);
    expect(canTransitionTask("completed", "running")).toBe(false);
  });

  it("разрешает cancelled из любого нетерминального статуса", () => {
    expect(canTransitionTask("pending", "cancelled")).toBe(true);
    expect(canTransitionTask("running", "cancelled")).toBe(true);
  });

  it("запрещает cancelled из терминального статуса", () => {
    expect(canTransitionTask("completed", "cancelled")).toBe(false);
    expect(canTransitionTask("failed", "cancelled")).toBe(false);
  });

  it("assertTaskTransition бросает InvalidTransitionError на недопустимом переходе", () => {
    expect(() => assertTaskTransition("pending", "completed")).toThrow(
      InvalidTransitionError,
    );
  });
});
