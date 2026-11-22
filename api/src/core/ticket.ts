import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

// Bilhete de pareamento: prova, por alguns minutos, que quem consultou a lista de equipamentos
// estava na mesma rede do aparelho. Serve quando o navegador e o aparelho falam com a API por
// famílias de IP diferentes (IPv6 x IPv4) e o IP do vínculo não bate com o do anúncio.

function sign(serial: string, expiresAt: number): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`pairing-ticket:${serial}:${expiresAt}`)
    .digest("base64url");
}

/** Bilhete para o serial, válido até `expiresAt` (ms desde 1970). */
export function signTicket(serial: string, expiresAt: number): string {
  return `${expiresAt}.${sign(serial, expiresAt)}`;
}

/** Confere assinatura e validade do bilhete para aquele serial. */
export function verifyTicket(serial: string, ticket: string, now = new Date()): boolean {
  const match = /^(\d{1,15})\.([A-Za-z0-9_-]{43})$/.exec(ticket);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= now.getTime()) return false;
  const expected = Buffer.from(sign(serial, expiresAt));
  const given = Buffer.from(match[2] as string);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
