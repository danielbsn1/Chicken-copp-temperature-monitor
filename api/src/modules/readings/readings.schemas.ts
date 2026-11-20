import { z } from "zod";
import { deviceId, utcInstant } from "../../core/schemas.js";

export const BUCKET_MS = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
} as const;

export type Bucket = keyof typeof BUCKET_MS;

export const MAX_POINTS = 1000;

/** `from` entra e `to` não entra; o intervalo não pode passar de 1.000 buckets. */
export const seriesQuery = z
  .object({
    deviceId,
    from: utcInstant,
    to: utcInstant,
    bucket: z.enum(["1m", "5m", "15m", "1h"]),
  })
  .superRefine((q, ctx) => {
    // Com from/to inválidos o zod já reportou o erro deles; não há o que comparar.
    if (!(q.from instanceof Date) || !(q.to instanceof Date)) return;
    if (q.from >= q.to) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from deve ser anterior a to",
      });
    } else if ((q.to.getTime() - q.from.getTime()) / BUCKET_MS[q.bucket] > MAX_POINTS) {
      ctx.addIssue({
        code: "custom",
        path: ["bucket"],
        message: `intervalo gera mais de ${MAX_POINTS} pontos; use um bucket maior ou um intervalo menor`,
      });
    }
  });

export type SeriesQuery = z.infer<typeof seriesQuery>;
