import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import Fastify, { type FastifyError } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { healthRoutes } from "./routes/health.js";
import { ingestRoutes } from "./routes/ingest.js";

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation
        .map((v) => `${v.instancePath || "/"} ${v.message}`)
        .join("; ");
      return reply
        .code(400)
        .send({ error: { code: "invalid_request", message } });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({
      error: {
        code: status >= 500 ? "internal_error" : "request_error",
        message: status >= 500 ? "Erro interno" : error.message,
      },
    });
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Monitor de temperatura do galinheiro",
        version: "0.1.0",
        description: "API que recebe as leituras do ESP32 e serve o painel.",
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(scalar, { routePrefix: "/docs" });

  await app.register(healthRoutes);
  await app.register(ingestRoutes, { prefix: "/api" });

  return app;
}
