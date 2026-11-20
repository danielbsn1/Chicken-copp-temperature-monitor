import { z } from "zod";

export const seriesSchema = z.object({
  deviceId: z.string(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  bucket: z.string(),
  points: z.array(
    z.object({
      ts: z.iso.datetime(),
      minC: z.number(),
      avgC: z.number(),
      maxC: z.number(),
    }),
  ),
});

export type Series = z.infer<typeof seriesSchema>;
