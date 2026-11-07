import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { closeSession, openSession } from "../lib/session.js";
import { loginBody, okResponse } from "../schemas/auth.js";
import { errorResponse } from "../schemas/error.js";
import { login } from "../services/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/auth/login",
    {
      schema: {
        tags: ["autenticação"],
        summary: "Abre a sessão do painel",
        description:
          "Em caso de sucesso, define o cookie de sessão (httpOnly).",
        body: loginBody,
        response: { 200: okResponse, 401: errorResponse, 429: errorResponse },
      },
    },
    async (request, reply) => {
      const result = await login(request.body.email, request.body.password);

      if (result.status === "locked") {
        return reply.code(429).send({
          error: {
            code: "too_many_attempts",
            message: "Muitas tentativas. Tente novamente mais tarde.",
          },
        });
      }
      if (result.status === "invalid") {
        return reply.code(401).send({
          error: { code: "unauthorized", message: "Credenciais inválidas" },
        });
      }

      openSession(reply, result.userId);
      return { ok: true as const };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/auth/logout",
    {
      schema: {
        tags: ["autenticação"],
        summary: "Encerra a sessão do painel",
        response: { 200: okResponse },
      },
    },
    async (_request, reply) => {
      closeSession(reply);
      return { ok: true as const };
    },
  );
}
