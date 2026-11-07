import { z } from "zod";

export const loginBody = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export type LoginBody = z.infer<typeof loginBody>;

export const okResponse = z.object({
  ok: z.literal(true),
});
