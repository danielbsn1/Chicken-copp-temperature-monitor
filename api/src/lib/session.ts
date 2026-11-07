import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export function openSession(reply: FastifyReply, userId: string) {
  reply.setCookie(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    signed: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function closeSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

// Devolve o id do usuário da sessão, ou null se o cookie não existe ou foi alterado.
export function sessionUserId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const { valid, value } = request.unsignCookie(raw);
  return valid && value ? value : null;
}

// Use como preHandler nas rotas do painel: { preHandler: requireSession }
export async function requireSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!sessionUserId(request)) {
    return reply.code(401).send({
      error: { code: "unauthorized", message: "Sessão inválida ou expirada" },
    });
  }
}
