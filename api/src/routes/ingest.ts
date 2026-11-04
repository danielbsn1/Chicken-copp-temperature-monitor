import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { errorResponse } from "../schemas/error.js";
import { ingestBody, ingestResponse } from "../schemas/ingest.js";
import { authenticateDevice } from "../services/device-auth.js";
import { InvalidTimestampError, ingest } from "../services/ingest.js";

export async function ingestRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/ingest",
    {
      schema: {
        tags: ["dispositivo"],
        summary: "Recebe amostras e eventos do ESP32",
        description: "A chave do dispositivo vai no cabeçalho X-Device-Key.",
        headers: z.object({ "x-device-key": z.string().optional() }),
        body: ingestBody,
        response: {
          200: ingestResponse,
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const device = await authenticateDevice(
        request.body.device_id,
        request.headers["x-device-key"],
      );
      if (!device) {
        return reply.code(401).send({
          error: {
            code: "unauthorized",
            message: "Chave do dispositivo inválida",
          },
        });
      }

      try {
        return await ingest(request.body);
      } catch (err) {
        if (err instanceof InvalidTimestampError) {
          return reply.code(400).send({
            error: { code: "invalid_timestamp", message: err.message },
          });
        }
        throw err;
      }
    },
  );
}
