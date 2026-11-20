import { z } from "zod";

export const statusSchema = z.object({
  reading: z
    .object({
      ts: z.iso.datetime(),
      tempC: z.number(),
      humPct: z.number(),
      fanOn: z.boolean(),
    })
    .nullable(),
  fanOn: z.boolean().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
  fwVersion: z.string().nullable(),
});

export type DeviceStatus = z.infer<typeof statusSchema>;
