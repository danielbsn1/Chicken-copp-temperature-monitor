import { z } from "zod";

export const errorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
