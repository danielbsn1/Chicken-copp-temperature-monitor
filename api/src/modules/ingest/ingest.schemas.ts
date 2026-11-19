import { z } from "zod";

export const MAX_ITEMS = 100;

export const EVENT_TYPES = [
  "fan_on",
  "fan_off",
  "temp_critical",
  "sensor_failure",
  "sensor_recovered",
  "boot",
  "connectivity_restored",
] as const;

/**
 * Formato do lote. Os itens ficam sem forma aqui de propósito: um item ruim não
 * pode derrubar o lote (400 faria o firmware descartar tudo). Cada item é
 * conferido à parte pelo serviço e, se inválido, só conta em `rejected`.
 */
export const batchSchema = z.object({
  deviceId: z.string().min(1),
  fwVersion: z.string().min(1).max(64),
  samples: z.array(z.unknown()).max(MAX_ITEMS),
  events: z.array(z.unknown()).max(MAX_ITEMS),
});

const utcTimestamp = z.iso.datetime();

export const sampleSchema = z.object({
  ts: utcTimestamp,
  tempC: z.number().min(-10).max(60),
  humPct: z.number().min(0).max(100),
  fanOn: z.boolean(),
});

export const eventSchema = z.object({
  ts: utcTimestamp,
  type: z.enum(EVENT_TYPES),
  detail: z.record(z.string(), z.json()).optional(),
});

export type Batch = z.infer<typeof batchSchema>;
export interface IngestResult {
  accepted: number;
  duplicates: number;
  rejected: number;
}
