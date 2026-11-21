import { z } from "zod";
import { deviceId } from "../../core/schemas.js";

/** Dia civil AAAA-MM-DD, no fuso America/Sao_Paulo; datas impossíveis (30/02) são recusadas. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato AAAA-MM-DD")
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    },
    { message: "dia inexistente" },
  );

export const dailyQuery = z.object({ deviceId, day });

export type DailyQuery = z.infer<typeof dailyQuery>;
