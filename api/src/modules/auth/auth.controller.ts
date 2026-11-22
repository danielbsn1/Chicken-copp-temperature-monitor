import type { CookieOptions, RequestHandler } from "express";
import { env } from "../../config/env.js";
import { SESSION_COOKIE } from "../../core/http/guards.js";
import { SESSION_MAX_AGE_MS, signSession } from "../../core/session.js";
import type { loginBody } from "./auth.schemas.js";
import * as service from "./auth.service.js";
import type { z } from "zod";

// Em produção o painel e a API ficam em sites diferentes (ex.: *.vercel.app), então o cookie
// precisa de SameSite=None (exige Secure) para ir nas chamadas do painel; local usa Lax.
const baseCookie = (): CookieOptions => {
  const secure = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginBody>;
  const user = await service.login(email, password);
  res.cookie(SESSION_COOKIE, signSession(user.id), {
    ...baseCookie(),
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.json(user);
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(SESSION_COOKIE, baseCookie());
  res.status(204).end();
};

export const me: RequestHandler = async (_req, res) => {
  res.json(await service.getUser(res.locals.userId as string));
};
