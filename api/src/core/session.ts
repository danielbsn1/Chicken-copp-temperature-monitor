import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Payload {
  sub: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

/** Gera o valor do cookie de sessão: payload assinado com SESSION_SECRET, válido por 7 dias. */
export function signSession(userId: string, now = new Date()): string {
  const payload: Payload = { sub: userId, exp: now.getTime() + SESSION_MAX_AGE_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/** Confere assinatura e validade. Devolve null para qualquer valor inválido. */
export function verifySession(
  token: string,
  now = new Date(),
): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];
  const expected = Buffer.from(sign(encoded));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Payload;
    if (typeof payload.sub !== "string" || payload.exp <= now.getTime()) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
