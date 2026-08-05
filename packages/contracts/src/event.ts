import { domainEventSchema, type DomainEvent } from "@pios/domain";
import { z } from "zod";

export const eventDtoSchema = domainEventSchema;
export type EventDto = DomainEvent;

export const listEventsResponseSchema = z.object({
  events: z.array(eventDtoSchema),
});
export type ListEventsResponse = z.infer<typeof listEventsResponseSchema>;
