import { z } from "zod";

export const healthResponse = z.object({
  status: z.literal("ok"),
});
