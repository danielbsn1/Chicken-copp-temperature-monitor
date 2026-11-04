import { z } from "zod";

export const EVENT_TYPES = [
  "BOOT",
  "FAN_ON",
  "FAN_OFF",
  "SENSOR_FAULT",
  "SENSOR_OK",
  "TEMP_CRITICAL",
  "WIFI_RECONNECT",
] as const;

const sample = z.object({
  ts: z.number().int().positive(),
  temp_c: z.number().min(-40).max(80),
  hum_pct: z.number().min(0).max(100),
  fan_on: z.boolean(),
});

const event = z.object({
  ts: z.number().int().positive(),
  type: z.enum(EVENT_TYPES),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const ingestBody = z.object({
  device_id: z.string().min(1).max(64),
  fw: z.string().max(32).optional(),
  health: z
    .object({
      rssi: z.number().int(),
      uptime_s: z.number().int().nonnegative(),
      free_heap: z.number().int().nonnegative(),
    })
    .optional(),
  samples: z.array(sample).max(100).default([]),
  events: z.array(event).max(100).default([]),
});

export type IngestBody = z.infer<typeof ingestBody>;

export const ingestResponse = z.object({
  accepted: z.number().int(),
  duplicates: z.number().int(),
});
