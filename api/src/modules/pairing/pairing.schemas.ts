import { z } from "zod";
import { email } from "../../core/schemas.js";

/** Número de série do equipamento (impresso na etiqueta); difícil de adivinhar: 8 a 64 caracteres. */
const serial = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "serial inválido");

/** O que o ESP32 manda ao se anunciar. A chave é gerada por ele e só o hash é gravado. */
export const announceBody = z.object({
  serial,
  key: z.string().regex(/^[0-9a-f]{64}$/, "a chave tem 64 caracteres hexadecimais"),
  fwVersion: z.string().min(1).max(64),
  /** true quando o botão de pareamento foi apertado: abre a janela de pareamento. */
  button: z.boolean().default(false),
});

const name = z.string().trim().min(1).max(100);

/** Vincular um equipamento achado na mesma rede. `manual` vale quando o IP não bate (usa o serial da etiqueta). */
export const claimBody = z.object({
  serial,
  name,
  manual: z.boolean().default(false),
  /** Bilhete devolvido pela consulta de equipamentos (prova a mesma rede). */
  ticket: z.string().max(100).optional(),
});

/** Cadastro de conta nova junto com o vínculo do primeiro equipamento. */
export const signupBody = claimBody.extend({
  email,
  password: z.string().min(12).max(200),
});

export type AnnounceBody = z.infer<typeof announceBody>;
export type ClaimBody = z.infer<typeof claimBody>;
export type SignupBody = z.infer<typeof signupBody>;
