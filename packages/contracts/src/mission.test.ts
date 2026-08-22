import { describe, expect, it } from "vitest";
import { createMissionRequestSchema } from "./mission";

describe("createMissionRequestSchema", () => {
  it("принимает непустой rawRequest", () => {
    expect(createMissionRequestSchema.safeParse({ rawRequest: "Собери отчёт" }).success).toBe(
      true,
    );
  });

  it("отклоняет пустой rawRequest", () => {
    expect(createMissionRequestSchema.safeParse({ rawRequest: "" }).success).toBe(false);
  });

  it("отклоняет rawRequest только из пробельных символов", () => {
    expect(createMissionRequestSchema.safeParse({ rawRequest: "   \n\t  " }).success).toBe(false);
  });

  it("отклоняет отсутствующий rawRequest", () => {
    expect(createMissionRequestSchema.safeParse({}).success).toBe(false);
  });
});
