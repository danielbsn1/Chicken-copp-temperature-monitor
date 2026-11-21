import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { NotFoundError, UnauthorizedError } from "../errors.js";
import { deviceId as deviceIdSchema } from "../schemas.js";
import { verifySession } from "../session.js";

export const SESSION_COOKIE = "session";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Protege o job diário: exige `Authorization: Bearer <CRON_SECRET>`. */
export const requireCronSecret: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return next(new UnauthorizedError("Credencial inválida"));
  }
  next();
};

function readCookie(header: string | undefined, name: string): string {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

/** Exige o cookie de sessão assinado e expõe o id em `res.locals.userId`. */
export const requireUser: RequestHandler = (req, res, next) => {
  const session = verifySession(readCookie(req.header("cookie"), SESSION_COOKIE));
  if (!session) return next(new UnauthorizedError());
  res.locals.userId = session.userId;
  next();
};

/**
 * Exige o cabeçalho `X-Device-Key`. O core não conhece módulos nem banco:
 * quem monta a rota passa a função que confere a chave (vem do módulo devices).
 */
export function requireDevice(
  authenticate: (key: string) => Promise<{ id: string } | null>,
): RequestHandler {
  return async (req, res, next) => {
    const key = req.header("x-device-key");
    if (!key) return next(new UnauthorizedError("Credencial inválida"));
    try {
      const device = await authenticate(key);
      if (!device) return next(new UnauthorizedError("Credencial inválida"));
      res.locals.deviceId = device.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Vale para qualquer rota com `?deviceId=`: exige sessão e que o equipamento seja do usuário
 * (a função `owns` vem do módulo devices). Equipamento de outra pessoa responde 404, igual a um
 * que não existe. Sem `deviceId` (ou com valor inválido) deixa passar: a validação da rota responde.
 */
export function requireOwnedDevice(
  owns: (userId: string, deviceId: string) => Promise<boolean>,
): RequestHandler {
  return (req, res, next) => {
    const raw = req.query.deviceId;
    if (typeof raw !== "string" || !deviceIdSchema.safeParse(raw).success) return next();
    requireUser(req, res, async (err?: unknown) => {
      if (err) return next(err);
      try {
        const ok = await owns(res.locals.userId as string, raw);
        next(ok ? undefined : new NotFoundError("Dispositivo não encontrado"));
      } catch (e) {
        next(e);
      }
    });
  };
}
