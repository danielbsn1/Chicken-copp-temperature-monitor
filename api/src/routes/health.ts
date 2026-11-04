import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { healthResponse } from "../schemas/health.js";

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        tags: ["sistema"],
        summary: "Verifica se a API está no ar",
        response: { 200: healthResponse },
      },
    },
    async () => ({ status: "ok" as const }),
  );
}
