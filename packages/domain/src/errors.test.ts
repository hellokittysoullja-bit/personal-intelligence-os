import { describe, expect, it } from "vitest";
import { DomainError, InvalidTransitionError } from "./errors";

describe("DomainError", () => {
  it("несёт код и сообщение", () => {
    const error = new DomainError("SOME_CODE", "что-то пошло не так");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("SOME_CODE");
    expect(error.message).toBe("что-то пошло не так");
  });
});

describe("InvalidTransitionError", () => {
  it("описывает недопустимый переход статуса", () => {
    const error = new InvalidTransitionError("Mission", "completed", "planning");
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("INVALID_TRANSITION");
    expect(error.message).toContain("completed");
    expect(error.message).toContain("planning");
  });
});
