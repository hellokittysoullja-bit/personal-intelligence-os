import { describe, expect, it } from "vitest";
import { createMissionCreatedEvent, domainEventSchema } from "./event";

describe("createMissionCreatedEvent", () => {
  it("создаёт валидное событие MissionCreated", () => {
    const event = createMissionCreatedEvent({
      ownerId: "owner-1",
      missionId: "550e8400-e29b-41d4-a716-446655440000",
      goalId: "550e8400-e29b-41d4-a716-446655440001",
      title: "Пример",
      objective: "Сделать пример",
    });

    expect(domainEventSchema.safeParse(event).success).toBe(true);
    expect(event.eventType).toBe("MissionCreated");
    expect(event.missionId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(event.correlationId).toBe(event.missionId);
    expect(event.causationId).toBeNull();
    expect(event.schemaVersion).toBe(1);
  });

  it("использует переданный traceId, если он есть", () => {
    const event = createMissionCreatedEvent({
      ownerId: "owner-1",
      missionId: "550e8400-e29b-41d4-a716-446655440000",
      goalId: "550e8400-e29b-41d4-a716-446655440001",
      title: "Пример",
      objective: "Сделать пример",
      traceId: "trace-123",
    });

    expect(event.traceId).toBe("trace-123");
  });
});
