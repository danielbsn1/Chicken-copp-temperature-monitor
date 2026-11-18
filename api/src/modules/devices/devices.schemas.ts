import { z } from "zod";

const deviceId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "use minúsculas, números e hífen (até 64)");

export const statusQuery = z.object({ deviceId });

/** Argumentos do `pnpm device:create <id> <nome>`; o nome pode ter espaços. */
export const createDeviceArgs = z
  .tuple([deviceId], z.string())
  .transform(([id, ...name]) => ({ id, name: name.join(" ") }))
  .pipe(z.object({ id: deviceId, name: z.string().min(1).max(100) }));
