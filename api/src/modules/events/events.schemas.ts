import { z } from "zod";
import { deviceId, utcInstant } from "../../core/schemas.js";

export const EVENT_TYPES = [
  "fan_on",
  "fan_off",
  "temp_critical",
  "sensor_failure",
  "sensor_recovered",
  "boot",
  "connectivity_restored",
] as const;

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/** `from` entra e `to` não entra no intervalo; os dois são opcionais. */
export const listQuery = z
  .object({
    deviceId,
    from: utcInstant.optional(),
    to: utcInstant.optional(),
    type: z.enum(EVENT_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  })
  .refine((q) => !q.from || !q.to || q.from < q.to, {
    message: "from deve ser anterior a to",
    path: ["from"],
  });

export type ListQuery = z.infer<typeof listQuery>;
