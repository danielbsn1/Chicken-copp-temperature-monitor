import { z } from "zod";

export const eventsSchema = z.object({
  deviceId: z.string(),
  events: z.array(
    z.object({
      ts: z.iso.datetime(),
      type: z.string(),
      detail: z.unknown().nullable(),
    }),
  ),
});

export type EventsResponse = z.infer<typeof eventsSchema>;
export type DeviceEvent = EventsResponse["events"][number];
