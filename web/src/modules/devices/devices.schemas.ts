import { z } from "zod";

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastSeenAt: z.string().nullable(),
  fwVersion: z.string().nullable(),
});
export const devicesSchema = z.object({ devices: z.array(deviceSchema) });

export const availableSchema = z.object({
  devices: z.array(
    z.object({
      serial: z.string(),
      fwVersion: z.string(),
      expiresAt: z.string().nullable(),
      ticket: z.string().nullable(),
    }),
  ),
});

export const claimedSchema = z.object({ deviceId: z.string(), name: z.string() });

export type Device = z.infer<typeof deviceSchema>;
export type AvailableDevice = z.infer<typeof availableSchema>["devices"][number];

/** Dados do vínculo: o serial achado na rede (ou digitado da etiqueta) e o nome do galinheiro. */
export interface ClaimInput {
  serial: string;
  name: string;
  /** true quando o serial foi digitado: vale mesmo fora da mesma rede. */
  manual: boolean;
  /** Bilhete da consulta: prova a mesma rede quando o IP do vínculo é de outra família. */
  ticket?: string;
}
export interface SignupInput extends ClaimInput {
  email: string;
  password: string;
}
