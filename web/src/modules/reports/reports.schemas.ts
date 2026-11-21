import { z } from "zod";

export const dailySchema = z.object({
  deviceId: z.string(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  tempAvgC: z.number(),
  fanOnMinutes: z.number().int(),
  readingsCount: z.number().int(),
});

export type DailySummary = z.infer<typeof dailySchema>;
