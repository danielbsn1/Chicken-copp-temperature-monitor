import { z } from "zod";

/** Identificador do dispositivo, igual ao cadastrado pelo `device:create`. */
export const deviceId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "use minúsculas, números e hífen (até 64)");

/** Instante em ISO 8601 UTC (termina em Z); chega como texto e sai como Date. */
export const utcInstant = z.iso.datetime().transform((value) => new Date(value));
